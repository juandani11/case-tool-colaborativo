package com.example.demo.ai;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AiQueryService {

    private static final List<String> ENTITIES = List.of("User", "Order", "Product", "Category");

    private static final String HELP_TEXT = "Comandos soportados:\n" +
        "  - 'hola', 'buenos dias', etc. -> Saludo\n" +
        "  - 'entidades', 'listar entidades' -> Lista las entidades del sistema\n" +
        "  - 'ayuda', 'help' -> Muestra esta ayuda\n" +
        "  - 'crear registro', 'nuevo' -> Instrucciones para crear registros\n" +
        "  - Cualquier otra consulta -> Respuesta generica";

    public AiQueryResponse process(String input) {
        if (input == null || input.isBlank()) {
            return new AiQueryResponse("Por favor, escribe algo para que pueda ayudarte.");
        }

        String lower = input.trim().toLowerCase();

        // Greetings
        if (lower.contains("hola") || lower.contains("buenos dias") ||
            lower.contains("buenas tardes") || lower.contains("buenas noches") ||
            lower.contains("hey") || lower.contains("saludos")) {
            return new AiQueryResponse("Hola! Soy el asistente de este backend. Puedo ayudarte a conocer las entidades disponibles o explicarte como usar la API. Escribe 'ayuda' para ver los comandos.");
        }

        // List entities
        if (lower.contains("entidad") || lower.contains("entidades") || lower.contains("listar")) {
            String entityList = ENTITIES.stream()
                .map(e -> "  - " + e + " -> /api/" + e.toLowerCase() + "s")
                .collect(Collectors.joining("\n"));
            return new AiQueryResponse(
                "Entidades disponibles en el sistema (" + ENTITIES.size() + "):\n" +
                entityList + "\n\n" +
                "Para listar registros: GET /api/<entidad>\n" +
                "Para crear registros: POST /api/<entidad>"
            );
        }

        // Help
        if (lower.contains("ayuda") || lower.contains("help") || lower.contains("comando")) {
            String entityList = ENTITIES.stream()
                .map(e -> "  - " + e)
                .collect(Collectors.joining("\n"));
            return new AiQueryResponse(
                HELP_TEXT + "\n\n" +
                "Entidades del sistema:\n" + entityList
            );
        }

        // Create record instructions
        if (lower.contains("crear") || lower.contains("nuevo") || lower.contains("agregar") || lower.contains("registrar")) {
            StringBuilder sb = new StringBuilder("Para crear un registro, usa el endpoint POST correspondiente:\n\n");
            for (String entity : ENTITIES) {
                String plural = entity.toLowerCase() + "s";
                sb.append("  POST /api/").append(plural).append("\n");
                sb.append("  Body: { \"campo\": \"valor\", ... }\n\n");
            }
            sb.append("Ejemplo con curl:\n");
            sb.append("  curl -X POST http://localhost:8080/api/").append(ENTITIES.get(0).toLowerCase()).append("s \\\n");
            sb.append("    -H \"Authorization: Bearer <token>\" \\\n");
            sb.append("    -H \"Content-Type: application/json\" \\\n");
            sb.append("    -d '{ \"nombre\": \"ejemplo\" }'");
            return new AiQueryResponse(sb.toString());
        }

        // Generic response
        return new AiQueryResponse(
            "No estoy seguro de entender tu consulta. Prueba con:\n" +
            "  - 'hola' para un saludo\n" +
            "  - 'entidades' para ver las entidades disponibles\n" +
            "  - 'ayuda' para ver los comandos soportados\n" +
            "  - 'crear registro' para instrucciones de creacion"
        );
    }
}
