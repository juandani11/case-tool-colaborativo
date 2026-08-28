package com.example.demo.service;

import com.example.demo.dto.EntityADTO;
import com.example.demo.entity.EntityA;
import com.example.demo.repository.EntityARepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.util.stream.Collectors;

@Service
public class EntityAService {

    @Autowired
    private EntityARepository repository;

    public List<EntityADTO> findAll() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public EntityADTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public EntityADTO save(EntityADTO dto) {
        EntityA entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    private EntityADTO toDTO(EntityA entity) {
        EntityADTO dto = new EntityADTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }

    private EntityA toEntity(EntityADTO dto) {
        EntityA entity = new EntityA();
        entity.setName(dto.getName());
        return entity;
    }
}