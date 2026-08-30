package com.example.demo.repository;

import com.example.demo.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;

@Repository
public interface ProductoRepository extends JpaRepository<Producto, UUID> {
}
