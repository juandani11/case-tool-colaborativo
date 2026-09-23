CREATE TABLE IF NOT EXISTS pedido (
    id UUID PRIMARY KEY NOT NULL,
    fecha DATE NOT NULL,
    total NUMERIC(19,2) NOT NULL,
    cliente_id UUID,
    CONSTRAINT fk_pedido_cliente_id FOREIGN KEY (cliente_id) REFERENCES cliente(id)
);

CREATE TABLE IF NOT EXISTS cliente (
    id UUID PRIMARY KEY NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefono INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS producto (
    id UUID PRIMARY KEY NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    precio NUMERIC(19,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS empleado (
    id UUID PRIMARY KEY NOT NULL,
    salario NUMERIC(19,2) NOT NULL,
    cargo VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS persona (
    id UUID PRIMARY KEY NOT NULL,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    fecha_nacimiento VARCHAR(255) NOT NULL,
    empleado_id UUID,
    CONSTRAINT fk_persona_empleado_id FOREIGN KEY (empleado_id) REFERENCES empleado(id)
);

CREATE TABLE IF NOT EXISTS pedido_producto (
    id UUID PRIMARY KEY NOT NULL UNIQUE,
    cantidad INTEGER NOT NULL,
    subtotal NUMERIC(19,2) NOT NULL,
    pedido_id UUID,
    CONSTRAINT fk_pedido_producto_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedido(id),
    producto_id UUID,
    CONSTRAINT fk_pedido_producto_producto_id FOREIGN KEY (producto_id) REFERENCES producto(id)
);

