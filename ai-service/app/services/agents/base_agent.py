"""
Base Agent Class
Foundation for all BESS management agents with common functionality.
"""

import asyncio
import uuid
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Callable, Set
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import logging
from collections import deque

logger = logging.getLogger(__name__)


class AgentState(Enum):
    """Agent lifecycle states"""
    INITIALIZING = "initializing"
    IDLE = "idle"
    ACTIVE = "active"
    BUSY = "busy"
    WAITING = "waiting"
    ERROR = "error"
    STOPPING = "stopping"
    STOPPED = "stopped"


class AgentPriority(Enum):
    """Message/task priority levels"""
    CRITICAL = 0    # Safety-critical, immediate
    HIGH = 1        # Important, process soon
    NORMAL = 2      # Standard priority
    LOW = 3         # Can be deferred
    BACKGROUND = 4  # Process when idle


class MessageType(Enum):
    """Types of inter-agent messages"""
    REQUEST = "request"
    RESPONSE = "response"
    NOTIFICATION = "notification"
    COMMAND = "command"
    QUERY = "query"
    ALERT = "alert"
    HEARTBEAT = "heartbeat"
    SYNC = "sync"


@dataclass
class AgentMessage:
    """Message for inter-agent communication"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str = ""
    receiver_id: str = ""  # Empty for broadcast
    message_type: MessageType = MessageType.NOTIFICATION
    priority: AgentPriority = AgentPriority.NORMAL
    topic: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    correlation_id: Optional[str] = None  # For request-response
    ttl_seconds: int = 60  # Time to live
    requires_ack: bool = False

    def is_expired(self) -> bool:
        """Check if message has expired"""
        age = (datetime.now() - self.timestamp).total_seconds()
        return age > self.ttl_seconds

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'receiver_id': self.receiver_id,
            'message_type': self.message_type.value,
            'priority': self.priority.value,
            'topic': self.topic,
            'payload': self.payload,
            'timestamp': self.timestamp.isoformat(),
            'correlation_id': self.correlation_id,
            'ttl_seconds': self.ttl_seconds
        }


@dataclass
class AgentCapability:
    """Describes an agent's capability"""
    name: str
    description: str
    input_schema: Dict[str, Any] = field(default_factory=dict)
    output_schema: Dict[str, Any] = field(default_factory=dict)
    priority: AgentPriority = AgentPriority.NORMAL


@dataclass
class AgentMetrics:
    """Agent performance metrics"""
    messages_received: int = 0
    messages_sent: int = 0
    tasks_completed: int = 0
    tasks_failed: int = 0
    average_response_time_ms: float = 0.0
    uptime_seconds: float = 0.0
    last_active: Optional[datetime] = None
    error_count: int = 0


class BaseAgent(ABC):
    """
    Abstract base class for all BESS management agents.

    Provides:
    - Lifecycle management (start, stop, pause)
    - Message passing infrastructure
    - State management
    - Capability registration
    - Metrics tracking
    """

    def __init__(
        self,
        agent_id: str,
        name: str,
        description: str = ""
    ):
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.state = AgentState.INITIALIZING
        self.start_time: Optional[datetime] = None

        # Communication
        self.inbox: asyncio.Queue = asyncio.Queue()
        self.outbox: asyncio.Queue = asyncio.Queue()
        self.message_handlers: Dict[str, Callable] = {}
        self.subscriptions: Set[str] = set()

        # Capabilities
        self.capabilities: Dict[str, AgentCapability] = {}

        # Metrics
        self.metrics = AgentMetrics()

        # Beliefs (agent's knowledge/state)
        self.beliefs: Dict[str, Any] = {}

        # Goals
        self.goals: List[Dict[str, Any]] = []

        # Task queue
        self._task_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._running = False
        self._main_task: Optional[asyncio.Task] = None

        # Pending responses
        self._pending_responses: Dict[str, asyncio.Future] = {}

        # Initialize capabilities
        self._register_capabilities()

    @abstractmethod
    def _register_capabilities(self):
        """Register agent capabilities - must be implemented by subclasses"""
        pass

    @abstractmethod
    async def _process_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process a task - must be implemented by subclasses"""
        pass

    def register_capability(self, capability: AgentCapability):
        """Register a capability"""
        self.capabilities[capability.name] = capability
        logger.debug(f"Agent {self.agent_id} registered capability: {capability.name}")

    def register_handler(self, topic: str, handler: Callable):
        """Register a message handler for a topic"""
        self.message_handlers[topic] = handler
        logger.debug(f"Agent {self.agent_id} registered handler for: {topic}")

    def subscribe(self, topic: str):
        """Subscribe to a topic"""
        self.subscriptions.add(topic)

    def unsubscribe(self, topic: str):
        """Unsubscribe from a topic"""
        self.subscriptions.discard(topic)

    async def start(self):
        """Start the agent"""
        if self._running:
            return

        self._running = True
        self.start_time = datetime.now()
        self.state = AgentState.IDLE

        # Start main processing loop
        self._main_task = asyncio.create_task(self._run())

        logger.info(f"Agent {self.name} ({self.agent_id}) started")

    async def stop(self):
        """Stop the agent"""
        self.state = AgentState.STOPPING
        self._running = False

        if self._main_task:
            self._main_task.cancel()
            try:
                await self._main_task
            except asyncio.CancelledError:
                pass

        self.state = AgentState.STOPPED
        logger.info(f"Agent {self.name} ({self.agent_id}) stopped")

    async def _run(self):
        """Main agent loop"""
        while self._running:
            try:
                # Process incoming messages
                await self._process_messages()

                # Process tasks
                await self._process_tasks()

                # Update metrics
                self._update_metrics()

                # Small delay to prevent busy loop
                await asyncio.sleep(0.01)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Agent {self.agent_id} error: {e}")
                self.metrics.error_count += 1
                self.state = AgentState.ERROR
                await asyncio.sleep(1)  # Back off on error

    async def _process_messages(self):
        """Process incoming messages"""
        try:
            while not self.inbox.empty():
                message = await asyncio.wait_for(
                    self.inbox.get(),
                    timeout=0.1
                )

                if message.is_expired():
                    logger.debug(f"Dropping expired message: {message.id}")
                    continue

                self.metrics.messages_received += 1
                await self._handle_message(message)

        except asyncio.TimeoutError:
            pass

    async def _handle_message(self, message: AgentMessage):
        """Handle an incoming message"""
        self.state = AgentState.BUSY
        start_time = datetime.now()

        try:
            # Check for response to pending request
            if message.correlation_id and message.correlation_id in self._pending_responses:
                future = self._pending_responses.pop(message.correlation_id)
                future.set_result(message)
                return

            # Check for registered handler
            if message.topic in self.message_handlers:
                handler = self.message_handlers[message.topic]
                result = await handler(message)

                # Send response if required
                if message.requires_ack or message.message_type == MessageType.REQUEST:
                    response = AgentMessage(
                        sender_id=self.agent_id,
                        receiver_id=message.sender_id,
                        message_type=MessageType.RESPONSE,
                        topic=message.topic,
                        payload=result or {},
                        correlation_id=message.id
                    )
                    await self.send_message(response)

            else:
                # Default handling
                await self._default_message_handler(message)

        except Exception as e:
            logger.error(f"Error handling message {message.id}: {e}")
            self.metrics.error_count += 1

        finally:
            # Update response time
            elapsed = (datetime.now() - start_time).total_seconds() * 1000
            self._update_response_time(elapsed)
            self.state = AgentState.IDLE

    async def _default_message_handler(self, message: AgentMessage):
        """Default handler for unhandled messages"""
        logger.debug(f"Agent {self.agent_id} received unhandled message: {message.topic}")

    async def _process_tasks(self):
        """Process queued tasks"""
        try:
            while not self._task_queue.empty():
                priority, task = await asyncio.wait_for(
                    self._task_queue.get(),
                    timeout=0.1
                )

                self.state = AgentState.BUSY
                start_time = datetime.now()

                try:
                    result = await self._process_task(task)
                    self.metrics.tasks_completed += 1

                    # Notify task completion if needed
                    if 'callback' in task:
                        await task['callback'](result)

                except Exception as e:
                    logger.error(f"Task processing error: {e}")
                    self.metrics.tasks_failed += 1

                finally:
                    elapsed = (datetime.now() - start_time).total_seconds() * 1000
                    self._update_response_time(elapsed)

        except asyncio.TimeoutError:
            pass
        finally:
            self.state = AgentState.IDLE

    async def send_message(self, message: AgentMessage):
        """Send a message to another agent or broadcast"""
        message.sender_id = self.agent_id
        await self.outbox.put(message)
        self.metrics.messages_sent += 1

    async def request(
        self,
        receiver_id: str,
        topic: str,
        payload: Dict[str, Any],
        timeout: float = 30.0,
        priority: AgentPriority = AgentPriority.NORMAL
    ) -> Optional[AgentMessage]:
        """Send a request and wait for response"""
        message = AgentMessage(
            sender_id=self.agent_id,
            receiver_id=receiver_id,
            message_type=MessageType.REQUEST,
            topic=topic,
            payload=payload,
            priority=priority,
            requires_ack=True
        )

        # Create future for response
        future: asyncio.Future = asyncio.Future()
        self._pending_responses[message.id] = future

        # Send request
        await self.send_message(message)

        try:
            response = await asyncio.wait_for(future, timeout=timeout)
            return response
        except asyncio.TimeoutError:
            self._pending_responses.pop(message.id, None)
            logger.warning(f"Request timeout: {topic} to {receiver_id}")
            return None

    def add_task(self, task: Dict[str, Any], priority: AgentPriority = AgentPriority.NORMAL):
        """Add a task to the queue"""
        self._task_queue.put_nowait((priority.value, task))

    def update_belief(self, key: str, value: Any):
        """Update agent's belief"""
        self.beliefs[key] = value

    def get_belief(self, key: str, default: Any = None) -> Any:
        """Get agent's belief"""
        return self.beliefs.get(key, default)

    def add_goal(self, goal: Dict[str, Any]):
        """Add a goal"""
        self.goals.append(goal)

    def remove_goal(self, goal_id: str):
        """Remove a goal by ID"""
        self.goals = [g for g in self.goals if g.get('id') != goal_id]

    def _update_response_time(self, elapsed_ms: float):
        """Update average response time"""
        total = self.metrics.tasks_completed + self.metrics.messages_received
        if total > 0:
            self.metrics.average_response_time_ms = (
                (self.metrics.average_response_time_ms * (total - 1) + elapsed_ms) / total
            )

    def _update_metrics(self):
        """Update agent metrics"""
        if self.start_time:
            self.metrics.uptime_seconds = (datetime.now() - self.start_time).total_seconds()
        self.metrics.last_active = datetime.now()

    def get_status(self) -> Dict[str, Any]:
        """Get agent status"""
        return {
            'agent_id': self.agent_id,
            'name': self.name,
            'state': self.state.value,
            'uptime_seconds': self.metrics.uptime_seconds,
            'metrics': {
                'messages_received': self.metrics.messages_received,
                'messages_sent': self.metrics.messages_sent,
                'tasks_completed': self.metrics.tasks_completed,
                'tasks_failed': self.metrics.tasks_failed,
                'average_response_time_ms': self.metrics.average_response_time_ms,
                'error_count': self.metrics.error_count
            },
            'capabilities': list(self.capabilities.keys()),
            'subscriptions': list(self.subscriptions),
            'pending_tasks': self._task_queue.qsize(),
            'pending_messages': self.inbox.qsize()
        }

    def get_capabilities(self) -> List[Dict[str, Any]]:
        """Get list of capabilities"""
        return [
            {
                'name': cap.name,
                'description': cap.description,
                'priority': cap.priority.value
            }
            for cap in self.capabilities.values()
        ]
