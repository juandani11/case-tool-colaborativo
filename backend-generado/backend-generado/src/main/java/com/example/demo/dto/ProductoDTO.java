package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ProductoDTO {

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UUID id;

    @NotNull(message = "nombre es obligatorio")
    @NotBlank(message = "nombre no puede estar vacio")
    @Size(max = 255, message = "nombre no puede exceder 255 caracteres")
    private String nombre;
    @NotNull(message = "precio es obligatorio")
    private BigDecimal precio;
    @NotNull(message = "stock es obligatorio")
    private Integer stock;

}
