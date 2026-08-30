package com.example.demo.ai;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2q.AllMiniLmL6V2QuantizedEmbeddingModel;
import dev.langchain4j.model.output.Response;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class IntentClassifier {

    private EmbeddingModel embeddingModel;
    private final Map<String, Embedding> intentEmbeddings = new LinkedHashMap<>();
    private static final float SIMILARITY_THRESHOLD = 0.35f;

    private static final Map<String, String> INTENT_DESCRIPTIONS = new LinkedHashMap<>();

    static {
        INTENT_DESCRIPTIONS.put("saludo",
            "hola buenos dias buenas tardes buenas noches hey saludos que tal como estas como te va");
        INTENT_DESCRIPTIONS.put("listar_entidades",
            "listar entidades que entidades existen mostrar entidades que hay en el sistema que tablas hay que modelos existen que objetos tengo");
        INTENT_DESCRIPTIONS.put("ayuda",
            "ayuda help que puedo hacer comandos disponibles como usar que opciones tengo que hacer");
        INTENT_DESCRIPTIONS.put("crear_registro",
            "crear registro nuevo registro agregar insertar guardar registrar agregar un nuevo objeto crear entidad");
        INTENT_DESCRIPTIONS.put("consultar_registro",
            "buscar obtener ver consultar detalle mostrar un registro especifico que datos tiene un objeto");
        INTENT_DESCRIPTIONS.put("eliminar_registro",
            "eliminar borrar quitar suprimir remover un registro un objeto");
        INTENT_DESCRIPTIONS.put("estadisticas",
            "estadisticas metricas resumen cuantos registros hay conteo total promedio");
        INTENT_DESCRIPTIONS.put("desconocido",
            "otra cosa diferente no relacionado con lo anterior");
    }

    @PostConstruct
    public void init() {
        try {
            embeddingModel = new AllMiniLmL6V2QuantizedEmbeddingModel();
            computeIntentEmbeddings();
            System.out.println("[IntentClassifier] Modelo de embeddings cargado. Intenciones: " + intentEmbeddings.size());
        } catch (Exception e) {
            System.err.println("[IntentClassifier] Error cargando modelo de embeddings: " + e.getMessage());
            embeddingModel = null;
        }
    }

    private void computeIntentEmbeddings() {
        for (Map.Entry<String, String> entry : INTENT_DESCRIPTIONS.entrySet()) {
            Response<Embedding> response = embeddingModel.embed(TextSegment.from(entry.getValue()));
            intentEmbeddings.put(entry.getKey(), response.content());
        }
    }

    public String classify(String query) {
        if (query == null || query.trim().isEmpty()) return "desconocido";
        if (embeddingModel == null || intentEmbeddings.isEmpty()) return fallbackClassify(query);

        try {
            Response<Embedding> queryResponse = embeddingModel.embed(TextSegment.from(query.toLowerCase().trim()));
            Embedding queryEmbedding = queryResponse.content();

            String bestIntent = "desconocido";
            double bestScore = -1.0;

            for (Map.Entry<String, Embedding> entry : intentEmbeddings.entrySet()) {
                double score = cosineSimilarity(queryEmbedding.vector(), entry.getValue().vector());
                if (score > bestScore) {
                    bestScore = score;
                    bestIntent = entry.getKey();
                }
            }

            System.out.println("[IntentClassifier] Query: \"" + query + "\" -> Intent: " + bestIntent + " (score: " + String.format("%.4f", bestScore) + ")");

            if (bestScore < SIMILARITY_THRESHOLD) {
                return "desconocido";
            }
            return bestIntent;
        } catch (Exception e) {
            System.err.println("[IntentClassifier] Error en clasificacion: " + e.getMessage());
            return fallbackClassify(query);
        }
    }

    private String fallbackClassify(String query) {
        String lower = query.toLowerCase().trim();

        if (containsAny(lower, "hola", "buenos", "buenas", "hey", "saludo")) {
            return "saludo";
        }
        if (containsAny(lower, "entidad", "entidades", "listar", "tabla", "tablas", "modelo")) {
            return "listar_entidades";
        }
        if (containsAny(lower, "ayuda", "help", "comando")) {
            return "ayuda";
        }
        if (containsAny(lower, "crear", "nuevo", "agregar", "registrar", "insertar")) {
            return "crear_registro";
        }
        if (containsAny(lower, "buscar", "obtener", "ver", "consultar", "detalle")) {
            return "consultar_registro";
        }
        if (containsAny(lower, "eliminar", "borrar", "quitar")) {
            return "eliminar_registro";
        }
        if (containsAny(lower, "estadistica", "metrica", "cuantos", "total", "conteo")) {
            return "estadisticas";
        }
        return "desconocido";
    }

    private boolean containsAny(String text, String... keywords) {
        for (String k : keywords) {
            if (text.contains(k)) return true;
        }
        return false;
    }

    private double cosineSimilarity(float[] a, float[] b) {
        double dot = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA == 0 || normB == 0) return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    public boolean isModelAvailable() {
        return embeddingModel != null;
    }
}
