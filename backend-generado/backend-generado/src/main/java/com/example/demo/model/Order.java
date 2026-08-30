package com.example.demo.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "order")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Order  {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;
    @Column(name = "total_amount", nullable = false)
    private BigDecimal totalAmount;

}
