package com.example.demo.ai;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class AiQueryRequest {
    private String query;

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }
}
