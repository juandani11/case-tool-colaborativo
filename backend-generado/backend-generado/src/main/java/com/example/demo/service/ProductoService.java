package com.example.demo.service;

import com.example.demo.dto.ProductoDTO;
import com.example.demo.model.Producto;
import com.example.demo.repository.ProductoRepository;
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
public class ProductoService {

    @Autowired
    private ProductoRepository repository;

    public Page<ProductoDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<ProductoDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public ProductoDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public ProductoDTO save(ProductoDTO dto) {
        Producto entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private ProductoDTO toDTO(Producto entity) {
        ProductoDTO dto = new ProductoDTO();
        dto.setId(entity.getId());
        dto.setNombre(entity.getNombre());
        dto.setPrecio(entity.getPrecio());
        dto.setStock(entity.getStock());
        return dto;
    }

    private Producto toEntity(ProductoDTO dto) {
        Producto entity = new Producto();
        entity.setNombre(dto.getNombre());
        entity.setPrecio(dto.getPrecio());
        entity.setStock(dto.getStock());
        return entity;
    }
}
