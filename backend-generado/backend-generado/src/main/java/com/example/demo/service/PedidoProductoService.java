package com.example.demo.service;

import com.example.demo.dto.PedidoProductoDTO;
import com.example.demo.model.PedidoProducto;
import com.example.demo.repository.PedidoProductoRepository;
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
public class PedidoProductoService {

    @Autowired
    private PedidoProductoRepository repository;

    public Page<PedidoProductoDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<PedidoProductoDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public PedidoProductoDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public PedidoProductoDTO save(PedidoProductoDTO dto) {
        PedidoProducto entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private PedidoProductoDTO toDTO(PedidoProducto entity) {
        PedidoProductoDTO dto = new PedidoProductoDTO();
        dto.setId(entity.getId());
        dto.setCantidad(entity.getCantidad());
        dto.setSubtotal(entity.getSubtotal());
        return dto;
    }

    private PedidoProducto toEntity(PedidoProductoDTO dto) {
        PedidoProducto entity = new PedidoProducto();
        entity.setCantidad(dto.getCantidad());
        entity.setSubtotal(dto.getSubtotal());
        return entity;
    }
}
