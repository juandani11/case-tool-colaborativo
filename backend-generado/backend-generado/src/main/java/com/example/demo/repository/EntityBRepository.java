package com.example.demo.repository;

import com.example.demo.entity.EntityB;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface EntityBRepository extends JpaRepository<EntityB, UUID> {
}