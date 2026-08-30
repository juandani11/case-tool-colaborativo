package com.example.demo.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "factura")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Factura  {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "fecha_factura", nullable = false)
    private LocalDate fechaFactura;
    @Column(name = "monto", nullable = false)
    private BigDecimal monto;

}
