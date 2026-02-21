"""
Agent Coordinator
Central orchestration system for multi-agent BESS management.
"""

import asyncio
from typing import Dict, Any, Optional, List, Set, Type
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import logging
from collections import defaultdict

from .base_agent import (
    BaseAgent,
    AgentState,
    AgentMessage,
    AgentPriority,
    MessageType,
    AgentCapability
)

logger = logging.getLogger(__name__)


class CoordinationStrategy(Enum):
    """Coordination strategies for multi-agent system"""
    HIERARCHICAL = "hierarchical"  # Top-down control
    COLLABORATIVE = "collaborative"  # Consensus-based
    MARKET_BASED = "market_based"  # Auction/bidding
    BLACKBOARD = "blackboard"  # Shared workspace
    CONTRACT_NET = "contract_net"  # Task announcement and bidding


class AgentRole(Enum):
    """Roles in the agent hierarchy"""
    COORDINATOR = "coordinator"
    SUPERVISOR = "supervisor"
    SPECIALIST = "specialist"
    WORKER = "worker"


@dataclass
class AgentRegistration:
    """Registration information for an agent"""
    agent_id: str
    agent: BaseAgent
    role: AgentRole
    capabilities: List[str]
    priority: int = 0
    registered_at: datetime = field(default_factory=datetime.now)
    last_seen: datetime = field(default_factory=datetime.now)
    status: AgentState = AgentState.INITIALIZING


@dataclass
class Task:
    """Task for agent execution"""
    id: str
    description: str
    required_capabilities: List[str]
    payload: Dict[str, Any]
    priority: AgentPriority
    deadline: Optional[datetime] = None
    assigned_agent: Optional[str] = None
    status: str = "pending"
    result: Optional[Dict[str, Any]] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class Contract:
    """Contract for contract-net protocol"""
    task_id: str
    announcer: str
    bidders: List[str] = field(default_factory=list)
    bids: Dict[str, float] = field(default_factory=dict)
    winner: Optional[str] = None
    status: str = "announced"
    deadline: datetime = field(default_factory=lambda: datetime.now() + timedelta(seconds=5))


class MessageRouter:
    """Routes messages between agents"""

    def __init__(self):
        self.subscriptions: Dict[str, Set[str]] = defaultdict(set)  # topic -> agent_ids
        self.agent_queues: Dict[str, asyncio.Queue] = {}

    def register_agent(self, agent_id: str, inbox: asyncio.Queue):
        """Register an agent's inbox"""
        self.agent_queues[agent_id] = inbox

    def unregister_agent(self, agent_id: str):
        """Unregister an agent"""
        self.agent_queues.pop(agent_id, None)
        for topic in self.subscriptions:
            self.subscriptions[topic].discard(agent_id)

    def subscribe(self, agent_id: str, topic: str):
        """Subscribe agent to topic"""
        self.subscriptions[topic].add(agent_id)

    def unsubscribe(self, agent_id: str, topic: str):
        """Unsubscribe agent from topic"""
        self.subscriptions[topic].discard(agent_id)

    async def route_message(self, message: AgentMessage):
        """Route a message to appropriate recipients"""
        recipients = set()

        if message.receiver_id:
            # Direct message
            recipients.add(message.receiver_id)
        else:
            # Broadcast to topic subscribers
            recipients = self.subscriptions.get(message.topic, set()).copy()

        # Also check for wildcard subscriptions
        for topic, subscribers in self.subscriptions.items():
            if topic.endswith('*') and message.topic.startswith(topic[:-1]):
                recipients.update(subscribers)

        # Deliver to recipients
        for recipient in recipients:
            if recipient in self.agent_queues and recipient != message.sender_id:
                try:
                    await self.agent_queues[recipient].put(message)
                except Exception as e:
                    logger.error(f"Failed to deliver message to {recipient}: {e}")


class Blackboard:
    """Shared workspace for blackboard coordination"""

    def __init__(self):
        self.data: Dict[str, Any] = {}
        self.history: List[Dict[str, Any]] = []
        self.watchers: Dict[str, List[str]] = defaultdict(list)  # key -> agent_ids
        self._lock = asyncio.Lock()

    async def write(self, key: str, value: Any, writer: str):
        """Write data to blackboard"""
        async with self._lock:
            old_value = self.data.get(key)
            self.data[key] = value

            # Record history
            self.history.append({
                'timestamp': datetime.now().isoformat(),
                'key': key,
                'old_value': old_value,
                'new_value': value,
                'writer': writer
            })

            # Limit history
            if len(self.history) > 1000:
                self.history = self.history[-1000:]

        # Return watchers to notify
        return self.watchers.get(key, [])

    async def read(self, key: str, default: Any = None) -> Any:
        """Read data from blackboard"""
        return self.data.get(key, default)

    async def watch(self, key: str, agent_id: str):
        """Watch a key for changes"""
        self.watchers[key].append(agent_id)

    async def unwatch(self, key: str, agent_id: str):
        """Stop watching a key"""
        if agent_id in self.watchers.get(key, []):
            self.watchers[key].remove(agent_id)

    def get_snapshot(self) -> Dict[str, Any]:
        """Get current state snapshot"""
        return self.data.copy()


class AgentCoordinator(BaseAgent):
    """
    Central coordinator for multi-agent BESS management system.

    Responsibilities:
    - Agent lifecycle management
    - Message routing
    - Task allocation
    - Coordination strategy execution
    - System-wide monitoring
    """

    def __init__(
        self,
        agent_id: str = "coordinator",
        name: str = "Agent Coordinator",
        strategy: CoordinationStrategy = CoordinationStrategy.HIERARCHICAL
    ):
        super().__init__(
            agent_id=agent_id,
            name=name,
            description="Central coordinator for multi-agent system"
        )

        self.strategy = strategy

        # Agent registry
        self.agents: Dict[str, AgentRegistration] = {}

        # Message router
        self.router = MessageRouter()

        # Blackboard (for BLACKBOARD strategy)
        self.blackboard = Blackboard()

        # Task management
        self.pending_tasks: Dict[str, Task] = {}
        self.active_tasks: Dict[str, Task] = {}
        self.completed_tasks: List[Task] = []

        # Contract management (for CONTRACT_NET strategy)
        self.active_contracts: Dict[str, Contract] = {}

        # Capability index
        self.capability_index: Dict[str, Set[str]] = defaultdict(set)  # capability -> agent_ids

        # Performance metrics
        self.task_stats = {
            'total_created': 0,
            'total_completed': 0,
            'total_failed': 0,
            'average_completion_time_ms': 0.0
        }

        # Heartbeat tracking
        self.heartbeat_interval_seconds = 5
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._routing_task: Optional[asyncio.Task] = None

    def _register_capabilities(self):
        """Register coordinator capabilities"""
        capabilities = [
            AgentCapability(
                name="agent_management",
                description="Register, monitor, and manage agents",
                priority=AgentPriority.HIGH
            ),
            AgentCapability(
                name="task_allocation",
                description="Allocate tasks to appropriate agents",
                priority=AgentPriority.HIGH
            ),
            AgentCapability(
                name="message_routing",
                description="Route messages between agents",
                priority=AgentPriority.CRITICAL
            ),
            AgentCapability(
                name="coordination",
                description="Coordinate multi-agent activities",
                priority=AgentPriority.HIGH
            ),
            AgentCapability(
                name="monitoring",
                description="Monitor system-wide health and performance",
                priority=AgentPriority.NORMAL
            )
        ]

        for cap in capabilities:
            self.register_capability(cap)

    async def start(self):
        """Start the coordinator"""
        await super().start()

        # Register own inbox for routing
        self.router.register_agent(self.agent_id, self.inbox)

        # Start heartbeat task
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        # Start message routing task
        self._routing_task = asyncio.create_task(self._routing_loop())

        logger.info(f"Coordinator started with strategy: {self.strategy.value}")

    async def stop(self):
        """Stop the coordinator"""
        # Stop background tasks
        for task in [self._heartbeat_task, self._routing_task]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        # Stop all registered agents
        for registration in self.agents.values():
            try:
                await registration.agent.stop()
            except Exception as e:
                logger.error(f"Error stopping agent {registration.agent_id}: {e}")

        await super().stop()

    async def _heartbeat_loop(self):
        """Send periodic heartbeats to agents"""
        while self._running:
            try:
                # Send heartbeat to all agents
                heartbeat = AgentMessage(
                    sender_id=self.agent_id,
                    message_type=MessageType.HEARTBEAT,
                    topic="system/heartbeat",
                    payload={'timestamp': datetime.now().isoformat()}
                )

                for agent_id in list(self.agents.keys()):
                    heartbeat.receiver_id = agent_id
                    await self.router.route_message(heartbeat)

                await asyncio.sleep(self.heartbeat_interval_seconds)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                await asyncio.sleep(1)

    async def _routing_loop(self):
        """Route messages from agent outboxes"""
        while self._running:
            try:
                # Collect messages from all agent outboxes
                for registration in list(self.agents.values()):
                    agent = registration.agent
                    while not agent.outbox.empty():
                        try:
                            message = await asyncio.wait_for(
                                agent.outbox.get(),
                                timeout=0.01
                            )
                            await self.router.route_message(message)
                        except asyncio.TimeoutError:
                            break

                # Also route our own outbox
                while not self.outbox.empty():
                    try:
                        message = await asyncio.wait_for(
                            self.outbox.get(),
                            timeout=0.01
                        )
                        await self.router.route_message(message)
                    except asyncio.TimeoutError:
                        break

                await asyncio.sleep(0.01)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Routing error: {e}")
                await asyncio.sleep(0.1)

    async def _process_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process coordinator tasks"""
        task_type = task.get('type', '')

        if task_type == 'register_agent':
            return await self._handle_agent_registration(task)
        elif task_type == 'allocate_task':
            return await self._allocate_task(task)
        elif task_type == 'broadcast':
            return await self._broadcast_message(task)
        elif task_type == 'sync_state':
            return await self._sync_system_state(task)
        else:
            return {'success': False, 'error': f'Unknown task type: {task_type}'}

    async def register_agent(
        self,
        agent: BaseAgent,
        role: AgentRole = AgentRole.WORKER
    ) -> bool:
        """Register an agent with the coordinator"""
        try:
            # Create registration
            registration = AgentRegistration(
                agent_id=agent.agent_id,
                agent=agent,
                role=role,
                capabilities=list(agent.capabilities.keys()),
                priority=self._get_role_priority(role)
            )

            # Add to registry
            self.agents[agent.agent_id] = registration

            # Register with router
            self.router.register_agent(agent.agent_id, agent.inbox)

            # Update capability index
            for capability in registration.capabilities:
                self.capability_index[capability].add(agent.agent_id)

            # Register agent's subscriptions
            for topic in agent.subscriptions:
                self.router.subscribe(agent.agent_id, topic)

            # Start the agent
            await agent.start()

            logger.info(f"Registered agent: {agent.agent_id} with role {role.value}")

            return True

        except Exception as e:
            logger.error(f"Failed to register agent {agent.agent_id}: {e}")
            return False

    async def unregister_agent(self, agent_id: str) -> bool:
        """Unregister an agent"""
        if agent_id not in self.agents:
            return False

        registration = self.agents[agent_id]

        # Stop the agent
        try:
            await registration.agent.stop()
        except Exception as e:
            logger.error(f"Error stopping agent {agent_id}: {e}")

        # Remove from router
        self.router.unregister_agent(agent_id)

        # Remove from capability index
        for capability in registration.capabilities:
            self.capability_index[capability].discard(agent_id)

        # Remove from registry
        del self.agents[agent_id]

        logger.info(f"Unregistered agent: {agent_id}")

        return True

    def _get_role_priority(self, role: AgentRole) -> int:
        """Get priority for role"""
        priorities = {
            AgentRole.COORDINATOR: 0,
            AgentRole.SUPERVISOR: 1,
            AgentRole.SPECIALIST: 2,
            AgentRole.WORKER: 3
        }
        return priorities.get(role, 3)

    async def create_task(
        self,
        description: str,
        required_capabilities: List[str],
        payload: Dict[str, Any],
        priority: AgentPriority = AgentPriority.NORMAL,
        deadline: Optional[datetime] = None
    ) -> Task:
        """Create and allocate a new task"""
        import uuid

        task = Task(
            id=str(uuid.uuid4()),
            description=description,
            required_capabilities=required_capabilities,
            payload=payload,
            priority=priority,
            deadline=deadline
        )

        self.pending_tasks[task.id] = task
        self.task_stats['total_created'] += 1

        # Allocate task based on strategy
        await self._allocate_task({'task': task})

        return task

    async def _allocate_task(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Allocate a task to an agent"""
        task = params.get('task')
        if not task:
            task_id = params.get('task_id')
            task = self.pending_tasks.get(task_id)

        if not task:
            return {'success': False, 'error': 'Task not found'}

        if self.strategy == CoordinationStrategy.HIERARCHICAL:
            return await self._allocate_hierarchical(task)
        elif self.strategy == CoordinationStrategy.COLLABORATIVE:
            return await self._allocate_collaborative(task)
        elif self.strategy == CoordinationStrategy.MARKET_BASED:
            return await self._allocate_market_based(task)
        elif self.strategy == CoordinationStrategy.CONTRACT_NET:
            return await self._allocate_contract_net(task)
        elif self.strategy == CoordinationStrategy.BLACKBOARD:
            return await self._allocate_blackboard(task)
        else:
            return await self._allocate_hierarchical(task)

    async def _allocate_hierarchical(self, task: Task) -> Dict[str, Any]:
        """Hierarchical task allocation - coordinator assigns based on capabilities"""
        # Find agents with required capabilities
        candidates = self._find_capable_agents(task.required_capabilities)

        if not candidates:
            return {
                'success': False,
                'error': 'No agent with required capabilities',
                'required': task.required_capabilities
            }

        # Select best agent (highest priority, least busy)
        best_agent = self._select_best_agent(candidates)

        if not best_agent:
            return {'success': False, 'error': 'No available agent'}

        # Assign task
        task.assigned_agent = best_agent
        task.status = "assigned"
        task.started_at = datetime.now()

        # Move to active tasks
        self.pending_tasks.pop(task.id, None)
        self.active_tasks[task.id] = task

        # Send task to agent
        message = AgentMessage(
            sender_id=self.agent_id,
            receiver_id=best_agent,
            message_type=MessageType.COMMAND,
            priority=task.priority,
            topic="task_assignment",
            payload={
                'task_id': task.id,
                'description': task.description,
                'payload': task.payload,
                'deadline': task.deadline.isoformat() if task.deadline else None
            }
        )

        await self.router.route_message(message)

        logger.info(f"Allocated task {task.id} to agent {best_agent}")

        return {
            'success': True,
            'task_id': task.id,
            'assigned_to': best_agent
        }

    async def _allocate_collaborative(self, task: Task) -> Dict[str, Any]:
        """Collaborative allocation - agents vote on who should take task"""
        candidates = self._find_capable_agents(task.required_capabilities)

        if not candidates:
            return {'success': False, 'error': 'No capable agents'}

        # Request votes from candidates
        votes: Dict[str, int] = defaultdict(int)

        for agent_id in candidates:
            # Ask each agent to vote
            response = await self._request_vote(agent_id, task)
            if response:
                voted_for = response.get('vote')
                if voted_for in candidates:
                    votes[voted_for] += 1

        # Agent with most votes wins
        if votes:
            winner = max(votes.keys(), key=lambda x: votes[x])
            task.assigned_agent = winner
            task.status = "assigned"

            self.pending_tasks.pop(task.id, None)
            self.active_tasks[task.id] = task

            # Notify winner
            await self._send_task_assignment(winner, task)

            return {'success': True, 'task_id': task.id, 'assigned_to': winner, 'votes': dict(votes)}

        return {'success': False, 'error': 'No votes received'}

    async def _allocate_market_based(self, task: Task) -> Dict[str, Any]:
        """Market-based allocation - agents bid for tasks"""
        candidates = self._find_capable_agents(task.required_capabilities)

        if not candidates:
            return {'success': False, 'error': 'No capable agents'}

        # Request bids
        bids: Dict[str, float] = {}

        for agent_id in candidates:
            bid = await self._request_bid(agent_id, task)
            if bid is not None:
                bids[agent_id] = bid

        # Lowest bid wins (assuming cost-based bidding)
        if bids:
            winner = min(bids.keys(), key=lambda x: bids[x])
            task.assigned_agent = winner
            task.status = "assigned"

            self.pending_tasks.pop(task.id, None)
            self.active_tasks[task.id] = task

            await self._send_task_assignment(winner, task)

            return {'success': True, 'task_id': task.id, 'assigned_to': winner, 'bid': bids[winner]}

        return {'success': False, 'error': 'No bids received'}

    async def _allocate_contract_net(self, task: Task) -> Dict[str, Any]:
        """Contract-net protocol allocation"""
        import uuid

        candidates = self._find_capable_agents(task.required_capabilities)

        if not candidates:
            return {'success': False, 'error': 'No capable agents'}

        # Create contract
        contract = Contract(
            task_id=task.id,
            announcer=self.agent_id,
            bidders=list(candidates)
        )

        self.active_contracts[task.id] = contract

        # Announce task to candidates
        announcement = AgentMessage(
            sender_id=self.agent_id,
            message_type=MessageType.REQUEST,
            topic="task_announcement",
            priority=task.priority,
            payload={
                'task_id': task.id,
                'description': task.description,
                'required_capabilities': task.required_capabilities,
                'deadline': contract.deadline.isoformat()
            }
        )

        for candidate in candidates:
            announcement.receiver_id = candidate
            await self.router.route_message(announcement)

        # Wait for bids
        await asyncio.sleep(5)  # Wait for bidding deadline

        # Evaluate bids
        if contract.bids:
            winner = min(contract.bids.keys(), key=lambda x: contract.bids[x])
            contract.winner = winner
            contract.status = "awarded"

            task.assigned_agent = winner
            task.status = "assigned"

            self.pending_tasks.pop(task.id, None)
            self.active_tasks[task.id] = task

            # Award contract
            award = AgentMessage(
                sender_id=self.agent_id,
                receiver_id=winner,
                message_type=MessageType.NOTIFICATION,
                topic="contract_awarded",
                payload={'task_id': task.id, 'task': task.payload}
            )
            await self.router.route_message(award)

            # Reject others
            for bidder in contract.bidders:
                if bidder != winner:
                    rejection = AgentMessage(
                        sender_id=self.agent_id,
                        receiver_id=bidder,
                        message_type=MessageType.NOTIFICATION,
                        topic="contract_rejected",
                        payload={'task_id': task.id}
                    )
                    await self.router.route_message(rejection)

            return {'success': True, 'task_id': task.id, 'assigned_to': winner}

        return {'success': False, 'error': 'No bids received'}

    async def _allocate_blackboard(self, task: Task) -> Dict[str, Any]:
        """Blackboard allocation - post task to shared workspace"""
        # Post task to blackboard
        watchers = await self.blackboard.write(
            f"task/{task.id}",
            {
                'id': task.id,
                'description': task.description,
                'required_capabilities': task.required_capabilities,
                'payload': task.payload,
                'status': 'available',
                'priority': task.priority.value
            },
            self.agent_id
        )

        # Notify watchers
        for watcher in watchers:
            notification = AgentMessage(
                sender_id=self.agent_id,
                receiver_id=watcher,
                message_type=MessageType.NOTIFICATION,
                topic="blackboard_update",
                payload={'key': f"task/{task.id}", 'action': 'task_available'}
            )
            await self.router.route_message(notification)

        return {
            'success': True,
            'task_id': task.id,
            'posted_to': 'blackboard',
            'notified': watchers
        }

    def _find_capable_agents(self, required_capabilities: List[str]) -> Set[str]:
        """Find agents with all required capabilities"""
        if not required_capabilities:
            return set(self.agents.keys())

        capable = None
        for capability in required_capabilities:
            agents_with_cap = self.capability_index.get(capability, set())
            if capable is None:
                capable = agents_with_cap.copy()
            else:
                capable &= agents_with_cap

        return capable or set()

    def _select_best_agent(self, candidates: Set[str]) -> Optional[str]:
        """Select best agent from candidates"""
        available = []

        for agent_id in candidates:
            registration = self.agents.get(agent_id)
            if registration and registration.status in [AgentState.IDLE, AgentState.ACTIVE]:
                available.append((
                    registration.priority,
                    registration.agent.metrics.tasks_completed,
                    agent_id
                ))

        if not available:
            return None

        # Sort by priority (lower is better), then by experience (higher is better)
        available.sort(key=lambda x: (x[0], -x[1]))

        return available[0][2]

    async def _request_vote(self, agent_id: str, task: Task) -> Optional[Dict[str, Any]]:
        """Request vote from agent"""
        message = AgentMessage(
            sender_id=self.agent_id,
            receiver_id=agent_id,
            message_type=MessageType.QUERY,
            topic="vote_request",
            payload={
                'task_id': task.id,
                'required_capabilities': task.required_capabilities
            }
        )

        response = await self._request_and_wait(agent_id, message, timeout=2.0)
        return response.payload if response else None

    async def _request_bid(self, agent_id: str, task: Task) -> Optional[float]:
        """Request bid from agent"""
        message = AgentMessage(
            sender_id=self.agent_id,
            receiver_id=agent_id,
            message_type=MessageType.QUERY,
            topic="bid_request",
            payload={
                'task_id': task.id,
                'description': task.description,
                'required_capabilities': task.required_capabilities
            }
        )

        response = await self._request_and_wait(agent_id, message, timeout=2.0)
        return response.payload.get('bid') if response else None

    async def _request_and_wait(
        self,
        agent_id: str,
        message: AgentMessage,
        timeout: float = 5.0
    ) -> Optional[AgentMessage]:
        """Send request and wait for response"""
        # Create future for response
        future: asyncio.Future = asyncio.Future()
        self._pending_responses[message.id] = future

        # Send message
        await self.router.route_message(message)

        try:
            response = await asyncio.wait_for(future, timeout=timeout)
            return response
        except asyncio.TimeoutError:
            self._pending_responses.pop(message.id, None)
            return None

    async def _send_task_assignment(self, agent_id: str, task: Task):
        """Send task assignment to agent"""
        message = AgentMessage(
            sender_id=self.agent_id,
            receiver_id=agent_id,
            message_type=MessageType.COMMAND,
            priority=task.priority,
            topic="task_assignment",
            payload={
                'task_id': task.id,
                'description': task.description,
                'payload': task.payload,
                'deadline': task.deadline.isoformat() if task.deadline else None
            }
        )

        await self.router.route_message(message)

    async def _handle_agent_registration(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle agent registration request"""
        agent = params.get('agent')
        role = params.get('role', AgentRole.WORKER)

        if not agent:
            return {'success': False, 'error': 'No agent provided'}

        success = await self.register_agent(agent, role)
        return {'success': success, 'agent_id': agent.agent_id if success else None}

    async def _broadcast_message(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Broadcast message to all agents"""
        topic = params.get('topic')
        payload = params.get('payload', {})
        priority = AgentPriority(params.get('priority', AgentPriority.NORMAL.value))

        message = AgentMessage(
            sender_id=self.agent_id,
            message_type=MessageType.NOTIFICATION,
            topic=topic,
            payload=payload,
            priority=priority
        )

        for agent_id in self.agents:
            message.receiver_id = agent_id
            await self.router.route_message(message)

        return {'success': True, 'recipients': len(self.agents)}

    async def _sync_system_state(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Synchronize system state across all agents"""
        state = self._collect_system_state()

        # Update blackboard
        await self.blackboard.write('system_state', state, self.agent_id)

        # Broadcast sync message
        sync_message = AgentMessage(
            sender_id=self.agent_id,
            message_type=MessageType.SYNC,
            topic="system/sync",
            payload=state
        )

        for agent_id in self.agents:
            sync_message.receiver_id = agent_id
            await self.router.route_message(sync_message)

        return {'success': True, 'state': state}

    def _collect_system_state(self) -> Dict[str, Any]:
        """Collect current system state"""
        return {
            'timestamp': datetime.now().isoformat(),
            'agents': {
                agent_id: {
                    'state': reg.agent.state.value,
                    'role': reg.role.value,
                    'last_seen': reg.last_seen.isoformat(),
                    'metrics': reg.agent.get_status().get('metrics', {})
                }
                for agent_id, reg in self.agents.items()
            },
            'tasks': {
                'pending': len(self.pending_tasks),
                'active': len(self.active_tasks),
                'completed': len(self.completed_tasks)
            },
            'strategy': self.strategy.value
        }

    async def handle_task_completion(self, task_id: str, result: Dict[str, Any]):
        """Handle task completion notification"""
        task = self.active_tasks.pop(task_id, None)

        if task:
            task.status = "completed"
            task.result = result
            task.completed_at = datetime.now()

            self.completed_tasks.append(task)
            self.task_stats['total_completed'] += 1

            # Update average completion time
            if task.started_at:
                completion_time = (task.completed_at - task.started_at).total_seconds() * 1000
                total = self.task_stats['total_completed']
                current_avg = self.task_stats['average_completion_time_ms']
                self.task_stats['average_completion_time_ms'] = (
                    (current_avg * (total - 1) + completion_time) / total
                )

            # Limit completed tasks history
            if len(self.completed_tasks) > 1000:
                self.completed_tasks = self.completed_tasks[-1000:]

            logger.info(f"Task {task_id} completed by {task.assigned_agent}")

    async def handle_task_failure(self, task_id: str, error: str):
        """Handle task failure"""
        task = self.active_tasks.pop(task_id, None)

        if task:
            task.status = "failed"
            task.result = {'error': error}
            task.completed_at = datetime.now()

            self.completed_tasks.append(task)
            self.task_stats['total_failed'] += 1

            logger.error(f"Task {task_id} failed: {error}")

            # Optionally retry
            if task.priority.value <= AgentPriority.HIGH.value:
                # Create retry task
                retry_task = Task(
                    id=f"{task.id}_retry",
                    description=task.description,
                    required_capabilities=task.required_capabilities,
                    payload=task.payload,
                    priority=task.priority
                )

                self.pending_tasks[retry_task.id] = task
                await self._allocate_task({'task': retry_task})

    def get_coordination_status(self) -> Dict[str, Any]:
        """Get current coordination status"""
        return {
            'coordinator_id': self.agent_id,
            'strategy': self.strategy.value,
            'agents': {
                agent_id: {
                    'role': reg.role.value,
                    'state': reg.agent.state.value,
                    'capabilities': reg.capabilities,
                    'last_seen': reg.last_seen.isoformat()
                }
                for agent_id, reg in self.agents.items()
            },
            'tasks': {
                'pending': len(self.pending_tasks),
                'active': len(self.active_tasks),
                'completed_total': len(self.completed_tasks)
            },
            'task_stats': self.task_stats,
            'capability_index': {k: list(v) for k, v in self.capability_index.items()},
            'blackboard_keys': list(self.blackboard.data.keys())
        }

    def get_agent_status(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific agent"""
        registration = self.agents.get(agent_id)
        if not registration:
            return None

        return {
            'agent_id': agent_id,
            'role': registration.role.value,
            'capabilities': registration.capabilities,
            'registered_at': registration.registered_at.isoformat(),
            'last_seen': registration.last_seen.isoformat(),
            **registration.agent.get_status()
        }
