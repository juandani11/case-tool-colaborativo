package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class OrderItemDTO {

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UUID id;

    @NotNull(message = "orderId es obligatorio")
    private UUID orderId;
    @NotNull(message = "productId es obligatorio")
    private UUID productId;
    @NotNull(message = "quantity es obligatorio")
    private Integer quantity;
    @NotNull(message = "unitPrice es obligatorio")
    private BigDecimal unitPrice;

}
