package com.example.demo.service;

import com.example.demo.dto.FacturaDTO;
import com.example.demo.model.Factura;
import com.example.demo.repository.FacturaRepository;
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
public class FacturaService {

    @Autowired
    private FacturaRepository repository;

    public Page<FacturaDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<FacturaDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public FacturaDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public FacturaDTO save(FacturaDTO dto) {
        Factura entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private FacturaDTO toDTO(Factura entity) {
        FacturaDTO dto = new FacturaDTO();
        dto.setId(entity.getId());
        dto.setFechaFactura(entity.getFechaFactura());
        dto.setMonto(entity.getMonto());
        return dto;
    }

    private Factura toEntity(FacturaDTO dto) {
        Factura entity = new Factura();
        entity.setFechaFactura(dto.getFechaFactura());
        entity.setMonto(dto.getMonto());
        return entity;
    }
}
