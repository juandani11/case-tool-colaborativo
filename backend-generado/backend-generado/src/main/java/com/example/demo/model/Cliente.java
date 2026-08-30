package com.example.demo.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "cliente")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Cliente  {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "nombre", nullable = false)
    private String nombre;
    @Column(name = "email", unique = true, nullable = false)
    private String email;
    @Column(name = "fecha_registro", nullable = false)
    private LocalDate fechaRegistro;

}
