package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UserDTO {

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UUID id;

    @NotNull(message = "username es obligatorio")
    @NotBlank(message = "username no puede estar vacio")
    @Size(max = 255, message = "username no puede exceder 255 caracteres")
    private String username;
    @NotNull(message = "email es obligatorio")
    @NotBlank(message = "email no puede estar vacio")
    @Size(max = 255, message = "email no puede exceder 255 caracteres")
    private String email;
    @NotNull(message = "createdAt es obligatorio")
    private LocalDate createdAt;

}
