package com.example.demo.repository;

import com.example.demo.model.Factura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;

@Repository
public interface FacturaRepository extends JpaRepository<Factura, UUID> {
}
