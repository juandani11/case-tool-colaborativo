package com.example.demo.ai;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    @Autowired
    private AiQueryService aiQueryService;

    @PostMapping("/query")
    public ResponseEntity<AiQueryResponse> query(@RequestBody AiQueryRequest request) {
        AiQueryResponse response = aiQueryService.process(request.getQuery());
        return ResponseEntity.ok(response);
    }
}
