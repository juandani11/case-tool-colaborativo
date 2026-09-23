package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PedidoProductoDTO {

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UUID id;

    @NotNull(message = "cantidad es obligatorio")
    private Integer cantidad;
    @NotNull(message = "subtotal es obligatorio")
    private BigDecimal subtotal;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private PedidoDTO pedido;

    private UUID pedidoId;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private ProductoDTO producto;

    private UUID productoId;

    public UUID getId() {
        return this.id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Integer getCantidad() {
        return this.cantidad;
    }

    public void setCantidad(Integer cantidad) {
        this.cantidad = cantidad;
    }

    public BigDecimal getSubtotal() {
        return this.subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
    }

    public PedidoDTO getPedido() {
        return this.pedido;
    }

    public void setPedido(PedidoDTO pedido) {
        this.pedido = pedido;
    }

    public UUID getPedidoId() {
        return this.pedidoId;
    }

    public void setPedidoId(UUID pedidoId) {
        this.pedidoId = pedidoId;
    }

    public ProductoDTO getProducto() {
        return this.producto;
    }

    public void setProducto(ProductoDTO producto) {
        this.producto = producto;
    }

    public UUID getProductoId() {
        return this.productoId;
    }

    public void setProductoId(UUID productoId) {
        this.productoId = productoId;
    }

}
