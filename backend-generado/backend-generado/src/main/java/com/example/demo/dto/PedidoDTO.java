package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PedidoDTO {

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UUID id;

    @NotNull(message = "fechaPedido es obligatorio")
    private LocalDate fechaPedido;
    @NotNull(message = "total es obligatorio")
    private BigDecimal total;

}
