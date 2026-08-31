package com.example.demo.controller;

import com.example.demo.dto.OrderDTO;
import com.example.demo.service.OrderService;
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
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderService service;

    @GetMapping
    public ResponseEntity<Page<OrderDTO>> getAll(Pageable pageable) {
        return ResponseEntity.ok(service.findAll(pageable));
    }

    @GetMapping("/all")
    public ResponseEntity<List<OrderDTO>> getAllNoPage() {
        return ResponseEntity.ok(service.findAllNoPage());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDTO> getById(@PathVariable UUID id) {
        OrderDTO dto = service.findById(id);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    @PostMapping
    public ResponseEntity<OrderDTO> create(@Valid @RequestBody OrderDTO dto) {
        return ResponseEntity.ok(service.save(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrderDTO> update(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDTO dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.save(dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
