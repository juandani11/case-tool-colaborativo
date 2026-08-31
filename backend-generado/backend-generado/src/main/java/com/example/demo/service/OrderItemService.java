package com.example.demo.service;

import com.example.demo.dto.OrderItemDTO;
import com.example.demo.model.OrderItem;
import com.example.demo.repository.OrderItemRepository;
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
public class OrderItemService {

    @Autowired
    private OrderItemRepository repository;

    public Page<OrderItemDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<OrderItemDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public OrderItemDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public OrderItemDTO save(OrderItemDTO dto) {
        OrderItem entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private OrderItemDTO toDTO(OrderItem entity) {
        OrderItemDTO dto = new OrderItemDTO();
        dto.setId(entity.getId());
        dto.setOrderId(entity.getOrderId());
        dto.setProductId(entity.getProductId());
        dto.setQuantity(entity.getQuantity());
        dto.setUnitPrice(entity.getUnitPrice());
        return dto;
    }

    private OrderItem toEntity(OrderItemDTO dto) {
        OrderItem entity = new OrderItem();
        entity.setOrderId(dto.getOrderId());
        entity.setProductId(dto.getProductId());
        entity.setQuantity(dto.getQuantity());
        entity.setUnitPrice(dto.getUnitPrice());
        return entity;
    }
}
