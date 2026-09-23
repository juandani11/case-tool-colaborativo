package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PersonaDTO {

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UUID id;

    @NotNull(message = "nombre es obligatorio")
    @NotBlank(message = "nombre no puede estar vacio")
    @Size(max = 255, message = "nombre no puede exceder 255 caracteres")
    private String nombre;
    @NotNull(message = "fechaNacimiento es obligatorio")
    @NotBlank(message = "fechaNacimiento no puede estar vacio")
    @Size(max = 255, message = "fechaNacimiento no puede exceder 255 caracteres")
    private String fechaNacimiento;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private EmpleadoDTO empleado;

    private UUID empleadoId;

    public UUID getId() {
        return this.id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getNombre() {
        return this.nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getFechaNacimiento() {
        return this.fechaNacimiento;
    }

    public void setFechaNacimiento(String fechaNacimiento) {
        this.fechaNacimiento = fechaNacimiento;
    }

    public EmpleadoDTO getEmpleado() {
        return this.empleado;
    }

    public void setEmpleado(EmpleadoDTO empleado) {
        this.empleado = empleado;
    }

    public UUID getEmpleadoId() {
        return this.empleadoId;
    }

    public void setEmpleadoId(UUID empleadoId) {
        this.empleadoId = empleadoId;
    }

}
