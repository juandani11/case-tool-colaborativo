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

    @NotNull(message = "fecha es obligatorio")
    private LocalDate fecha;
    @NotNull(message = "total es obligatorio")
    private BigDecimal total;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private ClienteDTO cliente;

    private UUID clienteId;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private List<PedidoProductoDTO> pedidoProductos = new java.util.ArrayList<>();

    public UUID getId() {
        return this.id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public LocalDate getFecha() {
        return this.fecha;
    }

    public void setFecha(LocalDate fecha) {
        this.fecha = fecha;
    }

    public BigDecimal getTotal() {
        return this.total;
    }

    public void setTotal(BigDecimal total) {
        this.total = total;
    }

    public ClienteDTO getCliente() {
        return this.cliente;
    }

    public void setCliente(ClienteDTO cliente) {
        this.cliente = cliente;
    }

    public UUID getClienteId() {
        return this.clienteId;
    }

    public void setClienteId(UUID clienteId) {
        this.clienteId = clienteId;
    }

    public List<PedidoProductoDTO> getPedidoProductos() {
        return this.pedidoProductos;
    }

    public void setPedidoProductos(List<PedidoProductoDTO> pedidoProductos) {
        this.pedidoProductos = pedidoProductos;
    }

}
