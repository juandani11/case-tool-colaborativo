package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class EmpleadoDTO {

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UUID id;

    @NotNull(message = "salario es obligatorio")
    private BigDecimal salario;
    @NotNull(message = "cargo es obligatorio")
    @NotBlank(message = "cargo no puede estar vacio")
    @Size(max = 255, message = "cargo no puede exceder 255 caracteres")
    private String cargo;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private PersonaDTO persona;

    private UUID personaId;

    public UUID getId() {
        return this.id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public BigDecimal getSalario() {
        return this.salario;
    }

    public void setSalario(BigDecimal salario) {
        this.salario = salario;
    }

    public String getCargo() {
        return this.cargo;
    }

    public void setCargo(String cargo) {
        this.cargo = cargo;
    }

    public PersonaDTO getPersona() {
        return this.persona;
    }

    public void setPersona(PersonaDTO persona) {
        this.persona = persona;
    }

    public UUID getPersonaId() {
        return this.personaId;
    }

    public void setPersonaId(UUID personaId) {
        this.personaId = personaId;
    }

}
