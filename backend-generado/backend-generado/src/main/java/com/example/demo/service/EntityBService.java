package com.example.demo.service;

import com.example.demo.dto.EntityBDTO;
import com.example.demo.entity.EntityB;
import com.example.demo.repository.EntityBRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.util.stream.Collectors;

@Service
public class EntityBService {

    @Autowired
    private EntityBRepository repository;

    public List<EntityBDTO> findAll() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public EntityBDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public EntityBDTO save(EntityBDTO dto) {
        EntityB entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    private EntityBDTO toDTO(EntityB entity) {
        EntityBDTO dto = new EntityBDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }

    private EntityB toEntity(EntityBDTO dto) {
        EntityB entity = new EntityB();
        entity.setName(dto.getName());
        return entity;
    }
}