package com.example.demo.controller;

import com.example.demo.dto.EntityADTO;
import com.example.demo.service.EntityAService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/entityas")
public class EntityAController {

    @Autowired
    private EntityAService service;

    @GetMapping
    public List<EntityADTO> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public EntityADTO getById(@PathVariable UUID id) {
        return service.findById(id);
    }

    @PostMapping
    public ResponseEntity<EntityADTO> create(@Valid @RequestBody EntityADTO dto) {
        return ResponseEntity.ok(service.save(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EntityADTO> update(@PathVariable UUID id, @Valid @RequestBody EntityADTO dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.save(dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}