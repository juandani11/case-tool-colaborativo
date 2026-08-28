package com.example.demo.repository;

import com.example.demo.entity.EntityC;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface EntityCRepository extends JpaRepository<EntityC, UUID> {
}