package com.example.demo.controller;

import com.example.demo.dto.FacturaDTO;
import com.example.demo.service.FacturaService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/facturas")
public class FacturaController {

    @Autowired
    private FacturaService service;

    @GetMapping
    public ResponseEntity<Page<FacturaDTO>> getAll(Pageable pageable) {
        return ResponseEntity.ok(service.findAll(pageable));
    }

    @GetMapping("/all")
    public ResponseEntity<List<FacturaDTO>> getAllNoPage() {
        return ResponseEntity.ok(service.findAllNoPage());
    }

    @GetMapping("/{id}")
    public ResponseEntity<FacturaDTO> getById(@PathVariable UUID id) {
        FacturaDTO dto = service.findById(id);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    @PostMapping
    public ResponseEntity<FacturaDTO> create(@Valid @RequestBody FacturaDTO dto) {
        return ResponseEntity.ok(service.save(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FacturaDTO> update(
            @PathVariable UUID id,
            @Valid @RequestBody FacturaDTO dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.save(dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
