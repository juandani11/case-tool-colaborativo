package com.example.demo.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "orderItem")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class OrderItem  {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;
    @Column(name = "product_id", nullable = false)
    private UUID productId;
    @Column(name = "quantity", nullable = false)
    private Integer quantity;
    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

}
