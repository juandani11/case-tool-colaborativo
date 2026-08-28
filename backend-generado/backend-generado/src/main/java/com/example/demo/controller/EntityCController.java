package com.example.demo.controller;

import com.example.demo.dto.EntityCDTO;
import com.example.demo.service.EntityCService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/entitycs")
public class EntityCController {

    @Autowired
    private EntityCService service;

    @GetMapping
    public List<EntityCDTO> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public EntityCDTO getById(@PathVariable UUID id) {
        return service.findById(id);
    }

    @PostMapping
    public ResponseEntity<EntityCDTO> create(@Valid @RequestBody EntityCDTO dto) {
        return ResponseEntity.ok(service.save(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EntityCDTO> update(@PathVariable UUID id, @Valid @RequestBody EntityCDTO dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.save(dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}