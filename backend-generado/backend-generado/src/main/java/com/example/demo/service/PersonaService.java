package com.example.demo.service;

import com.example.demo.dto.PersonaDTO;
import com.example.demo.model.Persona;
import com.example.demo.repository.PersonaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.stream.Collectors;

@Service
public class PersonaService {

    @Autowired
    private PersonaRepository repository;

    public Page<PersonaDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<PersonaDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public PersonaDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public PersonaDTO save(PersonaDTO dto) {
        Persona entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private PersonaDTO toDTO(Persona entity) {
        PersonaDTO dto = new PersonaDTO();
        dto.setId(entity.getId());
        dto.setNombre(entity.getNombre());
        dto.setFechaNacimiento(entity.getFechaNacimiento());
        return dto;
    }

    private Persona toEntity(PersonaDTO dto) {
        Persona entity = new Persona();
        entity.setNombre(dto.getNombre());
        entity.setFechaNacimiento(dto.getFechaNacimiento());
        return entity;
    }
}
