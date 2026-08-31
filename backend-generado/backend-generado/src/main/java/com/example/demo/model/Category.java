package com.example.demo.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "category")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Category  {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "name", unique = true, nullable = false)
    private String name;

}
