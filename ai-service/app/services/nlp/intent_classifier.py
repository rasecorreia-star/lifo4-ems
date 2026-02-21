"""
Intent Classifier for BESS Virtual Assistant
Classifies user intents using transformer-based models and rule-based fallback.
"""

import re
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import logging
import numpy as np

logger = logging.getLogger(__name__)


class IntentCategory(Enum):
    """High-level intent categories"""
    QUERY = "query"           # Information requests
    COMMAND = "command"       # Action requests
    ALERT = "alert"           # Alert management
    REPORT = "report"         # Report generation
    CONFIGURATION = "config"  # System configuration
    NAVIGATION = "navigation" # UI navigation
    HELP = "help"            # Help requests
    GREETING = "greeting"     # Social interactions
    UNKNOWN = "unknown"


class Intent(Enum):
    """Specific intents for BESS management"""
    # Query intents
    QUERY_SOC = "query_soc"
    QUERY_SOH = "query_soh"
    QUERY_POWER = "query_power"
    QUERY_ENERGY = "query_energy"
    QUERY_TEMPERATURE = "query_temperature"
    QUERY_VOLTAGE = "query_voltage"
    QUERY_CURRENT = "query_current"
    QUERY_STATUS = "query_status"
    QUERY_ALARMS = "query_alarms"
    QUERY_EFFICIENCY = "query_efficiency"
    QUERY_REVENUE = "query_revenue"
    QUERY_FORECAST = "query_forecast"
    QUERY_SCHEDULE = "query_schedule"

    # Command intents
    CMD_START_CHARGE = "cmd_start_charge"
    CMD_STOP_CHARGE = "cmd_stop_charge"
    CMD_START_DISCHARGE = "cmd_start_discharge"
    CMD_STOP_DISCHARGE = "cmd_stop_discharge"
    CMD_SET_POWER = "cmd_set_power"
    CMD_SET_SOC_LIMIT = "cmd_set_soc_limit"
    CMD_EMERGENCY_STOP = "cmd_emergency_stop"
    CMD_RESET_ALARMS = "cmd_reset_alarms"
    CMD_START_BALANCING = "cmd_start_balancing"
    CMD_RUN_OPTIMIZATION = "cmd_run_optimization"
    CMD_SCHEDULE_MAINTENANCE = "cmd_schedule_maintenance"

    # Alert intents
    ALERT_ACKNOWLEDGE = "alert_acknowledge"
    ALERT_SILENCE = "alert_silence"
    ALERT_ESCALATE = "alert_escalate"

    # Report intents
    REPORT_DAILY = "report_daily"
    REPORT_WEEKLY = "report_weekly"
    REPORT_MONTHLY = "report_monthly"
    REPORT_CUSTOM = "report_custom"
    REPORT_EXPORT = "report_export"

    # Configuration intents
    CONFIG_THRESHOLDS = "config_thresholds"
    CONFIG_NOTIFICATIONS = "config_notifications"
    CONFIG_SCHEDULE = "config_schedule"
    CONFIG_PARAMETERS = "config_parameters"

    # Navigation intents
    NAV_DASHBOARD = "nav_dashboard"
    NAV_ANALYTICS = "nav_analytics"
    NAV_SETTINGS = "nav_settings"
    NAV_ALARMS = "nav_alarms"
    NAV_REPORTS = "nav_reports"
    NAV_DIGITAL_TWIN = "nav_digital_twin"

    # Social intents
    GREETING = "greeting"
    FAREWELL = "farewell"
    THANKS = "thanks"
    HELP = "help"

    # Unknown
    UNKNOWN = "unknown"


@dataclass
class IntentResult:
    """Result of intent classification"""
    intent: Intent
    category: IntentCategory
    confidence: float
    alternatives: List[Tuple[Intent, float]] = field(default_factory=list)
    raw_scores: Dict[str, float] = field(default_factory=dict)
    method: str = "unknown"  # 'model', 'rules', 'hybrid'


# Intent patterns for rule-based classification
INTENT_PATTERNS = {
    # Query patterns
    Intent.QUERY_SOC: [
        r'\b(soc|state\s*of\s*charge|carga|nivel\s*de\s*carga|quanto\s+de\s+carga)\b',
        r'\b(qual|quanto|what|how\s+much)\b.*\b(bateria|battery|carga|charge)\b',
        r'\b(percentual|porcentagem|percent)\b.*\b(carga|charge|bateria)\b'
    ],
    Intent.QUERY_SOH: [
        r'\b(soh|state\s*of\s*health|saude|health|degradacao|degradation)\b',
        r'\b(como\s+esta|how\s+is)\b.*\b(saude|health|bateria|battery)\b',
        r'\b(ciclos|cycles|vida\s+util|lifetime)\b'
    ],
    Intent.QUERY_POWER: [
        r'\b(potencia|power|watts?|kw)\b',
        r'\b(quanto|what|how\s+much)\b.*\b(potencia|power)\b',
        r'\b(carregando|descarregando|charging|discharging)\b.*\b(quanto|how\s+much)\b'
    ],
    Intent.QUERY_TEMPERATURE: [
        r'\b(temperatura|temperature|temp|graus|degrees|celsius)\b',
        r'\b(quente|frio|hot|cold|aquecimento|heating)\b',
        r'\b(termica|thermal)\b'
    ],
    Intent.QUERY_VOLTAGE: [
        r'\b(voltagem|voltage|tensao|volts?)\b',
        r'\b(quanto|what)\b.*\b(volts?|tensao)\b'
    ],
    Intent.QUERY_CURRENT: [
        r'\b(corrente|current|amperes?|amps?)\b',
        r'\b(quanto|what)\b.*\b(corrente|current)\b'
    ],
    Intent.QUERY_STATUS: [
        r'\b(status|estado|situacao|condition)\b',
        r'\b(como\s+esta|how\s+is|what\'s)\b.*\b(sistema|system|bess|bateria)\b',
        r'\b(funcionando|working|operando|operating)\b'
    ],
    Intent.QUERY_ALARMS: [
        r'\b(alarmes?|alarms?|alertas?|alerts?|avisos?|warnings?)\b',
        r'\b(algum|any|tem|have)\b.*\b(problema|problem|erro|error|falha|fault)\b',
        r'\b(notificacoes|notifications)\b'
    ],
    Intent.QUERY_EFFICIENCY: [
        r'\b(eficiencia|efficiency|rendimento|performance)\b',
        r'\b(quanto|what|how)\b.*\b(eficiente|efficient)\b'
    ],
    Intent.QUERY_REVENUE: [
        r'\b(receita|revenue|lucro|profit|ganho|earnings|faturamento)\b',
        r'\b(quanto|how\s+much)\b.*\b(ganhou|earned|faturou|receita)\b',
        r'\b(dinheiro|money|financeiro|financial)\b'
    ],
    Intent.QUERY_FORECAST: [
        r'\b(previsao|forecast|projecao|projection|futuro|future)\b',
        r'\b(vai|will|going\s+to)\b.*\b(carregar|charge|descarregar|discharge)\b',
        r'\b(amanha|tomorrow|proximos?\s+dias?|next\s+days?)\b'
    ],
    Intent.QUERY_SCHEDULE: [
        r'\b(agenda|schedule|programacao|cronograma)\b',
        r'\b(quando|when)\b.*\b(carregar|charge|descarregar|discharge)\b',
        r'\b(horarios?|times?)\b.*\b(operacao|operation)\b'
    ],

    # Command patterns
    Intent.CMD_START_CHARGE: [
        r'\b(iniciar?|start|comecar?|begin)\b.*\b(carga|charge|carregamento|charging)\b',
        r'\b(carregar?|charge)\b.*\b(bateria|battery|bess)\b',
        r'\b(ligar?|turn\s+on|ativar?|activate)\b.*\b(carga|charge)\b'
    ],
    Intent.CMD_STOP_CHARGE: [
        r'\b(parar?|stop|interromper?|halt)\b.*\b(carga|charge|carregamento|charging)\b',
        r'\b(desligar?|turn\s+off|desativar?|deactivate)\b.*\b(carga|charge)\b'
    ],
    Intent.CMD_START_DISCHARGE: [
        r'\b(iniciar?|start|comecar?|begin)\b.*\b(descarga|discharge|descarregamento|discharging)\b',
        r'\b(descarregar?|discharge)\b.*\b(bateria|battery|bess)\b',
        r'\b(exportar?|export)\b.*\b(energia|energy|potencia|power)\b'
    ],
    Intent.CMD_STOP_DISCHARGE: [
        r'\b(parar?|stop|interromper?|halt)\b.*\b(descarga|discharge)\b'
    ],
    Intent.CMD_SET_POWER: [
        r'\b(definir?|set|ajustar?|adjust)\b.*\b(potencia|power)\b',
        r'\b(potencia|power)\b.*\b(\d+)\s*(kw|watts?)\b',
        r'\b(mudar?|change)\b.*\b(potencia|power)\b'
    ],
    Intent.CMD_SET_SOC_LIMIT: [
        r'\b(definir?|set|ajustar?|adjust)\b.*\b(limite|limit)\b.*\b(soc|carga)\b',
        r'\b(limite|limit)\b.*\b(\d+)\s*%',
        r'\b(minimo|maximo|minimum|maximum)\b.*\b(soc|carga|charge)\b'
    ],
    Intent.CMD_EMERGENCY_STOP: [
        r'\b(emergencia|emergency)\b',
        r'\b(parar?|stop)\b.*\b(tudo|everything|all)\b',
        r'\b(desligar?|shutdown|halt)\b.*\b(urgente|urgent|imediato|immediate)\b',
        r'\b(e-?stop|estop)\b'
    ],
    Intent.CMD_RESET_ALARMS: [
        r'\b(resetar?|reset|limpar?|clear)\b.*\b(alarmes?|alarms?|alertas?)\b',
        r'\b(reconhecer?|acknowledge)\b.*\b(alarmes?|alarms?)\b'
    ],
    Intent.CMD_START_BALANCING: [
        r'\b(iniciar?|start|comecar?)\b.*\b(balanceamento|balancing)\b',
        r'\b(balancear?|balance)\b.*\b(celulas?|cells?)\b',
        r'\b(equalizar?|equalize)\b'
    ],
    Intent.CMD_RUN_OPTIMIZATION: [
        r'\b(otimizar?|optimize|rodar?|run)\b.*\b(otimizacao|optimization)\b',
        r'\b(melhorar?|improve)\b.*\b(operacao|operation|performance)\b',
        r'\b(recalcular?|recalculate)\b.*\b(schedule|agenda)\b'
    ],

    # Alert patterns
    Intent.ALERT_ACKNOWLEDGE: [
        r'\b(reconhecer?|acknowledge|ok|entendi|understood)\b.*\b(alarme?|alarm|alerta?|alert)\b',
        r'\b(ja\s+vi|seen|checked)\b'
    ],
    Intent.ALERT_SILENCE: [
        r'\b(silenciar?|silence|mute|calar)\b.*\b(alarme?|alarm|alerta?|alert)\b'
    ],

    # Report patterns
    Intent.REPORT_DAILY: [
        r'\b(relatorio|report)\b.*\b(diario|daily|hoje|today)\b',
        r'\b(resumo|summary)\b.*\b(dia|day)\b'
    ],
    Intent.REPORT_WEEKLY: [
        r'\b(relatorio|report)\b.*\b(semanal|weekly|semana|week)\b'
    ],
    Intent.REPORT_MONTHLY: [
        r'\b(relatorio|report)\b.*\b(mensal|monthly|mes|month)\b'
    ],
    Intent.REPORT_EXPORT: [
        r'\b(exportar?|export|baixar?|download)\b.*\b(relatorio|report|dados|data)\b',
        r'\b(gerar?|generate)\b.*\b(pdf|excel|csv)\b'
    ],

    # Navigation patterns
    Intent.NAV_DASHBOARD: [
        r'\b(dashboard|painel|home|inicio)\b',
        r'\b(ir\s+para|go\s+to|abrir?|open)\b.*\b(dashboard|painel|principal)\b'
    ],
    Intent.NAV_ANALYTICS: [
        r'\b(analiticos?|analytics|analise|analysis)\b',
        r'\b(ir\s+para|go\s+to)\b.*\b(graficos?|charts?|analiticos?)\b'
    ],
    Intent.NAV_SETTINGS: [
        r'\b(configuracoes?|settings|config|opcoes?|options)\b',
        r'\b(ir\s+para|go\s+to)\b.*\b(configuracoes?|settings)\b'
    ],
    Intent.NAV_ALARMS: [
        r'\b(ir\s+para|go\s+to|mostrar?|show|ver|see)\b.*\b(alarmes?|alarms?|alertas?)\b'
    ],
    Intent.NAV_DIGITAL_TWIN: [
        r'\b(digital\s*twin|gemeo\s*digital|simulacao|simulation)\b',
        r'\b(ir\s+para|go\s+to)\b.*\b(twin|gemeo|simulador)\b'
    ],

    # Social patterns
    Intent.GREETING: [
        r'^(oi|ola|hi|hello|hey|bom\s+dia|boa\s+tarde|boa\s+noite|good\s+(morning|afternoon|evening))(\s|!|$)',
        r'^(e\s+ai|eai|fala|whats\s+up|wassup)(\s|!|$)'
    ],
    Intent.FAREWELL: [
        r'\b(tchau|bye|adeus|goodbye|ate\s+(logo|mais|depois)|see\s+you)\b'
    ],
    Intent.THANKS: [
        r'\b(obrigad[oa]|thanks?|thank\s+you|valeu|agradeco)\b'
    ],
    Intent.HELP: [
        r'\b(ajuda|help|socorro|como\s+(faco|usar?|funciona)|how\s+(to|do\s+i))\b',
        r'\b(o\s+que\s+(voce|vc)\s+(faz|pode)|what\s+can\s+you\s+do)\b',
        r'^(\?|help)$'
    ]
}

# Category mapping
INTENT_CATEGORIES = {
    Intent.QUERY_SOC: IntentCategory.QUERY,
    Intent.QUERY_SOH: IntentCategory.QUERY,
    Intent.QUERY_POWER: IntentCategory.QUERY,
    Intent.QUERY_ENERGY: IntentCategory.QUERY,
    Intent.QUERY_TEMPERATURE: IntentCategory.QUERY,
    Intent.QUERY_VOLTAGE: IntentCategory.QUERY,
    Intent.QUERY_CURRENT: IntentCategory.QUERY,
    Intent.QUERY_STATUS: IntentCategory.QUERY,
    Intent.QUERY_ALARMS: IntentCategory.QUERY,
    Intent.QUERY_EFFICIENCY: IntentCategory.QUERY,
    Intent.QUERY_REVENUE: IntentCategory.QUERY,
    Intent.QUERY_FORECAST: IntentCategory.QUERY,
    Intent.QUERY_SCHEDULE: IntentCategory.QUERY,
    Intent.CMD_START_CHARGE: IntentCategory.COMMAND,
    Intent.CMD_STOP_CHARGE: IntentCategory.COMMAND,
    Intent.CMD_START_DISCHARGE: IntentCategory.COMMAND,
    Intent.CMD_STOP_DISCHARGE: IntentCategory.COMMAND,
    Intent.CMD_SET_POWER: IntentCategory.COMMAND,
    Intent.CMD_SET_SOC_LIMIT: IntentCategory.COMMAND,
    Intent.CMD_EMERGENCY_STOP: IntentCategory.COMMAND,
    Intent.CMD_RESET_ALARMS: IntentCategory.COMMAND,
    Intent.CMD_START_BALANCING: IntentCategory.COMMAND,
    Intent.CMD_RUN_OPTIMIZATION: IntentCategory.COMMAND,
    Intent.CMD_SCHEDULE_MAINTENANCE: IntentCategory.COMMAND,
    Intent.ALERT_ACKNOWLEDGE: IntentCategory.ALERT,
    Intent.ALERT_SILENCE: IntentCategory.ALERT,
    Intent.ALERT_ESCALATE: IntentCategory.ALERT,
    Intent.REPORT_DAILY: IntentCategory.REPORT,
    Intent.REPORT_WEEKLY: IntentCategory.REPORT,
    Intent.REPORT_MONTHLY: IntentCategory.REPORT,
    Intent.REPORT_CUSTOM: IntentCategory.REPORT,
    Intent.REPORT_EXPORT: IntentCategory.REPORT,
    Intent.CONFIG_THRESHOLDS: IntentCategory.CONFIGURATION,
    Intent.CONFIG_NOTIFICATIONS: IntentCategory.CONFIGURATION,
    Intent.CONFIG_SCHEDULE: IntentCategory.CONFIGURATION,
    Intent.CONFIG_PARAMETERS: IntentCategory.CONFIGURATION,
    Intent.NAV_DASHBOARD: IntentCategory.NAVIGATION,
    Intent.NAV_ANALYTICS: IntentCategory.NAVIGATION,
    Intent.NAV_SETTINGS: IntentCategory.NAVIGATION,
    Intent.NAV_ALARMS: IntentCategory.NAVIGATION,
    Intent.NAV_REPORTS: IntentCategory.NAVIGATION,
    Intent.NAV_DIGITAL_TWIN: IntentCategory.NAVIGATION,
    Intent.GREETING: IntentCategory.GREETING,
    Intent.FAREWELL: IntentCategory.GREETING,
    Intent.THANKS: IntentCategory.GREETING,
    Intent.HELP: IntentCategory.HELP,
    Intent.UNKNOWN: IntentCategory.UNKNOWN
}


class IntentClassifier:
    """
    Intent classifier for BESS virtual assistant.

    Uses a hybrid approach:
    1. Sentence transformers for semantic similarity
    2. Rule-based pattern matching for high-precision intents
    3. Ensemble voting for final decision
    """

    def __init__(self, model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"):
        self.model_name = model_name
        self.model = None
        self.is_loaded = False

        # Intent embeddings cache
        self.intent_embeddings: Dict[Intent, np.ndarray] = {}

        # Training examples for each intent
        self.training_examples: Dict[Intent, List[str]] = self._get_training_examples()

        # Compiled patterns
        self.compiled_patterns: Dict[Intent, List[re.Pattern]] = {}
        self._compile_patterns()

    def _get_training_examples(self) -> Dict[Intent, List[str]]:
        """Get training examples for each intent"""
        return {
            Intent.QUERY_SOC: [
                "qual o SOC atual?",
                "quanto de carga tem a bateria?",
                "qual o nível de carga?",
                "what's the state of charge?",
                "how much charge is left?",
                "battery percentage?"
            ],
            Intent.QUERY_SOH: [
                "qual a saúde da bateria?",
                "como está o SOH?",
                "qual a degradação?",
                "what's the battery health?",
                "how many cycles remaining?",
                "lifetime estimate?"
            ],
            Intent.QUERY_POWER: [
                "qual a potência atual?",
                "quanto está gerando?",
                "quantos kW?",
                "what's the current power?",
                "how much power output?"
            ],
            Intent.QUERY_TEMPERATURE: [
                "qual a temperatura?",
                "está quente?",
                "temperatura das células?",
                "what's the temperature?",
                "is it overheating?"
            ],
            Intent.QUERY_STATUS: [
                "qual o status do sistema?",
                "como está funcionando?",
                "está tudo ok?",
                "what's the system status?",
                "is everything working?"
            ],
            Intent.QUERY_ALARMS: [
                "tem algum alarme?",
                "quais alertas ativos?",
                "algum problema?",
                "any active alarms?",
                "what warnings are there?"
            ],
            Intent.CMD_START_CHARGE: [
                "iniciar carga",
                "começar a carregar",
                "ligar carregamento",
                "start charging",
                "begin charge cycle"
            ],
            Intent.CMD_STOP_CHARGE: [
                "parar carga",
                "interromper carregamento",
                "stop charging",
                "halt charge"
            ],
            Intent.CMD_START_DISCHARGE: [
                "iniciar descarga",
                "começar a descarregar",
                "exportar energia",
                "start discharging",
                "begin discharge"
            ],
            Intent.CMD_EMERGENCY_STOP: [
                "parada de emergência",
                "desligar tudo urgente",
                "emergency stop",
                "e-stop now",
                "halt everything"
            ],
            Intent.GREETING: [
                "olá",
                "oi",
                "bom dia",
                "hello",
                "hi there"
            ],
            Intent.HELP: [
                "ajuda",
                "o que você pode fazer?",
                "como funciona?",
                "help",
                "what can you do?"
            ]
        }

    def _compile_patterns(self):
        """Compile regex patterns"""
        for intent, patterns in INTENT_PATTERNS.items():
            self.compiled_patterns[intent] = [
                re.compile(pattern, re.IGNORECASE)
                for pattern in patterns
            ]

    async def load_model(self):
        """Load the sentence transformer model"""
        try:
            from sentence_transformers import SentenceTransformer

            logger.info(f"Loading intent classifier model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)

            # Pre-compute embeddings for training examples
            await self._compute_intent_embeddings()

            self.is_loaded = True
            logger.info("Intent classifier model loaded successfully")

        except ImportError:
            logger.warning("sentence-transformers not installed. Using rule-based classification only.")
            self.is_loaded = True
        except Exception as e:
            logger.error(f"Failed to load intent classifier model: {e}")
            self.is_loaded = True  # Still usable with rules

    async def _compute_intent_embeddings(self):
        """Pre-compute embeddings for training examples"""
        if self.model is None:
            return

        for intent, examples in self.training_examples.items():
            if examples:
                embeddings = self.model.encode(examples)
                # Average embedding for this intent
                self.intent_embeddings[intent] = np.mean(embeddings, axis=0)

    def classify(self, text: str) -> IntentResult:
        """
        Classify the intent of user input.

        Args:
            text: User input text

        Returns:
            IntentResult with classified intent and confidence
        """
        text = text.strip()

        if not text:
            return IntentResult(
                intent=Intent.UNKNOWN,
                category=IntentCategory.UNKNOWN,
                confidence=0.0,
                method="empty"
            )

        # Try rule-based classification first for high-precision intents
        rule_result = self._classify_rules(text)

        # If we have a model, also try semantic classification
        model_result = None
        if self.model is not None and self.intent_embeddings:
            model_result = self._classify_semantic(text)

        # Combine results
        if rule_result.confidence >= 0.9:
            # High confidence rule match - use it
            return rule_result
        elif model_result and model_result.confidence >= 0.8:
            # High confidence model match
            if rule_result.confidence >= 0.5 and rule_result.intent == model_result.intent:
                # Both agree - boost confidence
                return IntentResult(
                    intent=model_result.intent,
                    category=INTENT_CATEGORIES.get(model_result.intent, IntentCategory.UNKNOWN),
                    confidence=min(1.0, (rule_result.confidence + model_result.confidence) / 1.5),
                    alternatives=model_result.alternatives,
                    method="hybrid"
                )
            return model_result
        elif rule_result.confidence >= 0.5:
            # Moderate rule confidence
            return rule_result
        elif model_result and model_result.confidence >= 0.5:
            return model_result
        else:
            # Low confidence - return best guess
            if model_result and model_result.confidence > rule_result.confidence:
                return model_result
            return rule_result

    def _classify_rules(self, text: str) -> IntentResult:
        """Classify using rule-based patterns"""
        text_lower = text.lower()
        scores: Dict[Intent, float] = {}

        for intent, patterns in self.compiled_patterns.items():
            max_score = 0.0
            for pattern in patterns:
                match = pattern.search(text_lower)
                if match:
                    # Score based on match length relative to text
                    match_len = len(match.group())
                    text_len = len(text)
                    score = min(1.0, (match_len / text_len) * 2)

                    # Boost for full match patterns
                    if match.start() == 0 and match.end() == len(text.strip()):
                        score = 1.0

                    max_score = max(max_score, score)

            if max_score > 0:
                scores[intent] = max_score

        if not scores:
            return IntentResult(
                intent=Intent.UNKNOWN,
                category=IntentCategory.UNKNOWN,
                confidence=0.0,
                method="rules"
            )

        # Sort by score
        sorted_intents = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_intent, top_score = sorted_intents[0]

        alternatives = [
            (intent, score)
            for intent, score in sorted_intents[1:4]
            if score >= 0.3
        ]

        return IntentResult(
            intent=top_intent,
            category=INTENT_CATEGORIES.get(top_intent, IntentCategory.UNKNOWN),
            confidence=top_score,
            alternatives=alternatives,
            raw_scores=scores,
            method="rules"
        )

    def _classify_semantic(self, text: str) -> IntentResult:
        """Classify using semantic similarity"""
        if self.model is None or not self.intent_embeddings:
            return IntentResult(
                intent=Intent.UNKNOWN,
                category=IntentCategory.UNKNOWN,
                confidence=0.0,
                method="model"
            )

        # Encode input text
        text_embedding = self.model.encode([text])[0]

        # Calculate similarities
        scores: Dict[Intent, float] = {}
        for intent, intent_embedding in self.intent_embeddings.items():
            similarity = self._cosine_similarity(text_embedding, intent_embedding)
            scores[intent] = (similarity + 1) / 2  # Normalize to 0-1

        # Sort by score
        sorted_intents = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_intent, top_score = sorted_intents[0]

        alternatives = [
            (intent, score)
            for intent, score in sorted_intents[1:4]
            if score >= 0.3
        ]

        return IntentResult(
            intent=top_intent,
            category=INTENT_CATEGORIES.get(top_intent, IntentCategory.UNKNOWN),
            confidence=top_score,
            alternatives=alternatives,
            raw_scores=scores,
            method="model"
        )

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    def get_supported_intents(self) -> List[Dict[str, Any]]:
        """Get list of supported intents"""
        return [
            {
                "intent": intent.value,
                "category": INTENT_CATEGORIES.get(intent, IntentCategory.UNKNOWN).value,
                "has_patterns": intent in self.compiled_patterns,
                "has_examples": intent in self.training_examples
            }
            for intent in Intent
        ]
