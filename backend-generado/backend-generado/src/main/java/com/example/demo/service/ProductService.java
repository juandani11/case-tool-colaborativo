package com.example.demo.service;

import com.example.demo.dto.ProductDTO;
import com.example.demo.model.Product;
import com.example.demo.repository.ProductRepository;
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
public class ProductService {

    @Autowired
    private ProductRepository repository;

    public Page<ProductDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<ProductDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public ProductDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public ProductDTO save(ProductDTO dto) {
        Product entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private ProductDTO toDTO(Product entity) {
        ProductDTO dto = new ProductDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setPrice(entity.getPrice());
        dto.setCategoryId(entity.getCategoryId());
        return dto;
    }

    private Product toEntity(ProductDTO dto) {
        Product entity = new Product();
        entity.setName(dto.getName());
        entity.setPrice(dto.getPrice());
        entity.setCategoryId(dto.getCategoryId());
        return entity;
    }
}
