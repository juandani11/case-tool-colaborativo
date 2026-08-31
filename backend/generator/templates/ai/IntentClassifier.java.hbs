package com.example.demo.ai;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2q.AllMiniLmL6V2QuantizedEmbeddingModel;
import dev.langchain4j.model.output.Response;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class IntentClassifier {

    private EmbeddingModel embeddingModel;
    private final Map<String, float[]> intentVectors = new LinkedHashMap<>();
    private static final float SIMILARITY_THRESHOLD = 0.4f;

    private static final Map<String, String> INTENT_DESCRIPTIONS;

    static {
        Map<String, String> descriptions = new LinkedHashMap<>();
        descriptions.put("saludo",
            "hola buenos dias buenas tardes buenas noches hey saludos que tal como estas como te va");
        descriptions.put("listar_entidades",
            "listar entidades que entidades existen mostrar entidades que hay en el sistema que tablas hay que modelos existen que objetos tengo ver entidades");
        descriptions.put("ayuda",
            "ayuda help que puedo hacer comandos disponibles como usar que opciones tengo que hacer");
        descriptions.put("crear_registro",
            "crear registro nuevo registro agregar insertar guardar registrar agregar un nuevo objeto crear entidad añadir");
        descriptions.put("consultar_registro",
            "buscar obtener ver consultar detalle mostrar un registro especifico que datos tiene un objeto");
        descriptions.put("eliminar_registro",
            "eliminar borrar quitar suprimir remover un registro un objeto");
        descriptions.put("estadisticas",
            "estadisticas metricas resumen cuantos registros hay conteo total promedio");
        descriptions.put("desconocido",
            "otra cosa diferente no relacionado con lo anterior");
        INTENT_DESCRIPTIONS = Collections.unmodifiableMap(descriptions);
    }

    @PostConstruct
    public void init() {
        try {
            embeddingModel = new AllMiniLmL6V2QuantizedEmbeddingModel();
            computeIntentEmbeddings();
            System.out.println("[IntentClassifier] Modelo de embeddings cargado OK. Intenciones: " + intentVectors.size());
        } catch (Exception e) {
            System.err.println("[IntentClassifier] Modelo NO disponible, usando solo fallback por keywords: " + e.getMessage());
            embeddingModel = null;
        }
    }

    private void computeIntentEmbeddings() {
        for (Map.Entry<String, String> entry : INTENT_DESCRIPTIONS.entrySet()) {
            Response<Embedding> response = embeddingModel.embed(TextSegment.from(entry.getValue()));
            intentVectors.put(entry.getKey(), response.content().vector());
        }
    }

    public String classify(String query) {
        if (query == null || query.trim().isEmpty()) return "desconocido";

        // Siempre intentar fallback primero por keywords (rápido y preciso para comandos simples)
        String fallbackResult = fallbackClassify(query);
        if (!"desconocido".equals(fallbackResult)) {
            System.out.println("[IntentClassifier] Fallback keyword: \"" + query + "\" -> " + fallbackResult);
            return fallbackResult;
        }

        // Si no hubo match por keywords, intentar con embeddings
        if (embeddingModel == null || intentVectors.isEmpty()) {
            System.out.println("[IntentClassifier] Sin modelo, sin keyword match: \"" + query + "\" -> desconocido");
            return "desconocido";
        }

        try {
            Response<Embedding> queryResponse = embeddingModel.embed(TextSegment.from(query.toLowerCase().trim()));
            float[] queryVector = queryResponse.content().vector();

            String bestIntent = "desconocido";
            double bestScore = -1.0;

            for (Map.Entry<String, float[]> entry : intentVectors.entrySet()) {
                double score = cosineSimilarity(queryVector, entry.getValue());
                if (score > bestScore) {
                    bestScore = score;
                    bestIntent = entry.getKey();
                }
            }

            System.out.println("[IntentClassifier] Embeddings: \"" + query + "\" -> " + bestIntent + " (score: " + String.format("%.4f", bestScore) + ")");

            if (bestScore < SIMILARITY_THRESHOLD) {
                System.out.println("[IntentClassifier] Score " + String.format("%.4f", bestScore) + " < " + SIMILARITY_THRESHOLD + ", resultado: desconocido");
                return "desconocido";
            }
            return bestIntent;
        } catch (Exception e) {
            System.err.println("[IntentClassifier] Error en embeddings: " + e.getMessage());
            return "desconocido";
        }
    }

    private String fallbackClassify(String query) {
        String lower = query.toLowerCase().trim();

        if (containsAny(lower, "hola", "buenos dias", "buenas tardes", "buenas noches", "hey", "que tal", "saludo", "saludos")) {
            return "saludo";
        }
        if (containsAny(lower, "listar entidades", "ver entidades", "que entidades", "entidades", "listar entidades", "tabla", "tablas", "modelo", "modelos")) {
            return "listar_entidades";
        }
        if (containsAny(lower, "ayuda", "help", "comandos", "comando", "opciones", "que puedo hacer")) {
            return "ayuda";
        }
        if (containsAny(lower, "crear", "nuevo", "agregar", "añadir", "registrar", "insertar")) {
            return "crear_registro";
        }
        if (containsAny(lower, "buscar", "obtener", "ver registro", "consultar", "detalle", "mostrar")) {
            return "consultar_registro";
        }
        if (containsAny(lower, "eliminar", "borrar", "quitar", "suprimir", "remover")) {
            return "eliminar_registro";
        }
        if (containsAny(lower, "estadistica", "estadisticas", "metrica", "metricas", "cuantos", "total", "conteo", "resumen")) {
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
        if (a.length != b.length) return 0;
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
