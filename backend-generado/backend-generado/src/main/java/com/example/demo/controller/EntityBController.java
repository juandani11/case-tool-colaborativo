package com.example.demo.controller;

import com.example.demo.dto.EntityBDTO;
import com.example.demo.service.EntityBService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/entitybs")
public class EntityBController {

    @Autowired
    private EntityBService service;

    @GetMapping
    public List<EntityBDTO> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public EntityBDTO getById(@PathVariable UUID id) {
        return service.findById(id);
    }

    @PostMapping
    public ResponseEntity<EntityBDTO> create(@Valid @RequestBody EntityBDTO dto) {
        return ResponseEntity.ok(service.save(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EntityBDTO> update(@PathVariable UUID id, @Valid @RequestBody EntityBDTO dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.save(dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}