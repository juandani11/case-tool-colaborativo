package com.example.demo.controller;

import com.example.demo.dto.PedidoProductoDTO;
import com.example.demo.service.PedidoProductoService;
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
@RequestMapping("/api/pedido_productos")
public class PedidoProductoController {

    @Autowired
    private PedidoProductoService service;

    @GetMapping
    public ResponseEntity<Page<PedidoProductoDTO>> getAll(Pageable pageable) {
        return ResponseEntity.ok(service.findAll(pageable));
    }

    @GetMapping("/all")
    public ResponseEntity<List<PedidoProductoDTO>> getAllNoPage() {
        return ResponseEntity.ok(service.findAllNoPage());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PedidoProductoDTO> getById(@PathVariable UUID id) {
        PedidoProductoDTO dto = service.findById(id);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    @PostMapping
    public ResponseEntity<PedidoProductoDTO> create(@Valid @RequestBody PedidoProductoDTO dto) {
        return ResponseEntity.ok(service.save(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PedidoProductoDTO> update(
            @PathVariable UUID id,
            @Valid @RequestBody PedidoProductoDTO dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.save(dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
