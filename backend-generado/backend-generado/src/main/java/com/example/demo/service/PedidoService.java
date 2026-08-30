package com.example.demo.service;

import com.example.demo.dto.PedidoDTO;
import com.example.demo.model.Pedido;
import com.example.demo.repository.PedidoRepository;
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
public class PedidoService {

    @Autowired
    private PedidoRepository repository;

    public Page<PedidoDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<PedidoDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public PedidoDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public PedidoDTO save(PedidoDTO dto) {
        Pedido entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private PedidoDTO toDTO(Pedido entity) {
        PedidoDTO dto = new PedidoDTO();
        dto.setId(entity.getId());
        dto.setFechaPedido(entity.getFechaPedido());
        dto.setTotal(entity.getTotal());
        return dto;
    }

    private Pedido toEntity(PedidoDTO dto) {
        Pedido entity = new Pedido();
        entity.setFechaPedido(dto.getFechaPedido());
        entity.setTotal(dto.getTotal());
        return entity;
    }
}
