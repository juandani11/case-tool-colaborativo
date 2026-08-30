package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ClienteDTO {

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UUID id;

    @NotNull(message = "nombre es obligatorio")
    @NotBlank(message = "nombre no puede estar vacio")
    @Size(max = 255, message = "nombre no puede exceder 255 caracteres")
    private String nombre;
    @NotNull(message = "email es obligatorio")
    @NotBlank(message = "email no puede estar vacio")
    @Size(max = 255, message = "email no puede exceder 255 caracteres")
    private String email;
    @NotNull(message = "fechaRegistro es obligatorio")
    private LocalDate fechaRegistro;

}
