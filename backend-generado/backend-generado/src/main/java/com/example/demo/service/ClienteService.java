package com.example.demo.service;

import com.example.demo.dto.ClienteDTO;
import com.example.demo.model.Cliente;
import com.example.demo.repository.ClienteRepository;
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
public class ClienteService {

    @Autowired
    private ClienteRepository repository;

    public Page<ClienteDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<ClienteDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public ClienteDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public ClienteDTO save(ClienteDTO dto) {
        Cliente entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private ClienteDTO toDTO(Cliente entity) {
        ClienteDTO dto = new ClienteDTO();
        dto.setId(entity.getId());
        dto.setNombre(entity.getNombre());
        dto.setEmail(entity.getEmail());
        dto.setFechaRegistro(entity.getFechaRegistro());
        return dto;
    }

    private Cliente toEntity(ClienteDTO dto) {
        Cliente entity = new Cliente();
        entity.setNombre(dto.getNombre());
        entity.setEmail(dto.getEmail());
        entity.setFechaRegistro(dto.getFechaRegistro());
        return entity;
    }
}
