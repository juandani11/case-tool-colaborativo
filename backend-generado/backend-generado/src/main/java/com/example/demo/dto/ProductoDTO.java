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

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private List<PedidoProductoDTO> pedidoProductos = new java.util.ArrayList<>();

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

    public BigDecimal getPrecio() {
        return this.precio;
    }

    public void setPrecio(BigDecimal precio) {
        this.precio = precio;
    }

    public List<PedidoProductoDTO> getPedidoProductos() {
        return this.pedidoProductos;
    }

    public void setPedidoProductos(List<PedidoProductoDTO> pedidoProductos) {
        this.pedidoProductos = pedidoProductos;
    }

}
