package com.example.demo.ai;

import lombok.*;

@Getter @Setter
public class AiQueryResponse {
    private String response;
    private String intent;

    public AiQueryResponse() { }

    public AiQueryResponse(String response, String intent) {
        this.response = response;
        this.intent = intent;
    }

    public String getResponse() { return response; }
    public void setResponse(String response) { this.response = response; }

    public String getIntent() { return intent; }
    public void setIntent(String intent) { this.intent = intent; }
}
