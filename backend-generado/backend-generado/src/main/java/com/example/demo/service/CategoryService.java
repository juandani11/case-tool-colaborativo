package com.example.demo.service;

import com.example.demo.dto.CategoryDTO;
import com.example.demo.model.Category;
import com.example.demo.repository.CategoryRepository;
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
public class CategoryService {

    @Autowired
    private CategoryRepository repository;

    public Page<CategoryDTO> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toDTO);
    }

    public List<CategoryDTO> findAllNoPage() {
        return repository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    public CategoryDTO findById(UUID id) {
        return repository.findById(id).map(this::toDTO).orElse(null);
    }

    public CategoryDTO save(CategoryDTO dto) {
        Category entity = toEntity(dto);
        return toDTO(repository.save(entity));
    }

    public void delete(UUID id) {
        repository.deleteById(id);
    }

    // ── Mapping ──────────────────────────────────────────────

    private CategoryDTO toDTO(Category entity) {
        CategoryDTO dto = new CategoryDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }

    private Category toEntity(CategoryDTO dto) {
        Category entity = new Category();
        entity.setName(dto.getName());
        return entity;
    }
}
