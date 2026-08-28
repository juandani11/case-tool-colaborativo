package com.example.demo.repository;

import com.example.demo.entity.EntityA;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface EntityARepository extends JpaRepository<EntityA, UUID> {
}