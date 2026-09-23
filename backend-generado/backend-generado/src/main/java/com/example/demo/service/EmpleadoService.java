package com.example.demo.service;

import com.example.demo.dto.EmpleadoDTO;
import com.example.demo.model.Empleado;
import com.example.demo.repository.EmpleadoRepository;
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
public class EmpleadoService {

    @Autowired
    private EmpleadoRepository repository;

    public Page<EmpleadoDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<EmpleadoDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public EmpleadoDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public EmpleadoDTO save(EmpleadoDTO dto) {
        Empleado entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private EmpleadoDTO toDTO(Empleado entity) {
        EmpleadoDTO dto = new EmpleadoDTO();
        dto.setId(entity.getId());
        dto.setSalario(entity.getSalario());
        dto.setCargo(entity.getCargo());
        return dto;
    }

    private Empleado toEntity(EmpleadoDTO dto) {
        Empleado entity = new Empleado();
        entity.setSalario(dto.getSalario());
        entity.setCargo(dto.getCargo());
        return entity;
    }
}
