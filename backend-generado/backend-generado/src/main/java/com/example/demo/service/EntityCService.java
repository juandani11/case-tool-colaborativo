package com.example.demo.service;

import com.example.demo.dto.EntityCDTO;
import com.example.demo.entity.EntityC;
import com.example.demo.repository.EntityCRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.util.stream.Collectors;

@Service
public class EntityCService {

    @Autowired
    private EntityCRepository repository;

    public List<EntityCDTO> findAll() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public EntityCDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public EntityCDTO save(EntityCDTO dto) {
        EntityC entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    private EntityCDTO toDTO(EntityC entity) {
        EntityCDTO dto = new EntityCDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }

    private EntityC toEntity(EntityCDTO dto) {
        EntityC entity = new EntityC();
        entity.setName(dto.getName());
        return entity;
    }
}