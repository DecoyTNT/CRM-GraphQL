const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const crearToken = (usuario) => {
    const { id, nombre, apellido, email } = usuario;

    return jwt.sign({ id, nombre, apellido, email }, process.env.SECRETA, { expiresIn: '24h' });
}

// Resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async (_, { }, ctx) => {
            try {
                return ctx.usuario;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerProductos: async () => {
            try {
                const productos = await Producto.find();
                return productos;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerProducto: async (_, { id }) => {
            try {
                const producto = await Producto.findById(id);
                if (!producto) {
                    throw new Error('No existe un producto con ese id');
                }
                return producto;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find();
                return clientes
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerClientesVendedor: async (_, { }, ctx) => {
            try {
                const clientes = await Cliente.find({ vendedor: ctx.usuario.id });
                return clientes
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerCliente: async (_, { id }, ctx) => {
            try {
                const cliente = await Cliente.findById(id);
                if (!cliente) {
                    throw new Error('No existe el cliente');
                }

                if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                    throw new Error('Este cliente pertenece a otro vendedor');
                }
                return cliente
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find();
                return pedidos
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerPedidosVendedor: async (_, { }, ctx) => {
            try {
                const pedidos = await Pedido.find({ vendedor: ctx.usuario.id }).populate('cliente');
                return pedidos
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerPedido: async (_, { id }, ctx) => {
            try {
                // Verificar si el pedido existe
                const pedido = await Pedido.findById(id).populate('cliente');
                if (!pedido) {
                    throw new Error('No existe el pedido');
                }

                // Verificar que el pedido corresponda al vendedor
                if (pedido.vendedor.toString() !== ctx.usuario.id.toString()) {
                    throw new Error('Este pedido corresponde a otro vendedor');
                }

                return pedido;

            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        obtenerPedidosEstado: async (_, { estado }, ctx) => {
            try {
                const pedidos = await Pedido.find({ estado, vendedor: ctx.usuario.id });
                return pedidos;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        mejoresClientes: async () => {
            try {
                const clientes = await Pedido.aggregate([
                    {
                        // filtrar pedidos por estado
                        $match: {
                            estado: 'Completado'
                        }
                    },
                    {
                        // agrupar Cliente con la suma de todos sus pedidos
                        $group: {
                            _id: '$cliente',
                            total: {
                                $sum: '$total'
                            }
                        }
                    },
                    {
                        // Es como un innerJoin de SQL, aquí es donde se une el modelo de cliente con la suma de los pedidos
                        $lookup: {
                            from: 'clientes',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'cliente'
                        }
                    },
                    {
                        // Solo se mostraran como maximo 10 clientes
                        $limit: 10
                    },
                    {
                        // Se ordena dependiendo que vendedor tuvo mas ventas
                        $sort: {
                            total: -1
                        }
                    }
                ]);
                return clientes;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        mejoresVendedores: async () => {
            try {
                const vendedores = await Pedido.aggregate([
                    {
                        // filtrar pedidos por estado
                        $match: {
                            estado: 'Completado'
                        }
                    },
                    {
                        // agrupar Vendedor con la suma de todos sus pedidos
                        $group: {
                            _id: '$vendedor',
                            total: {
                                $sum: '$total'
                            }
                        }
                    },
                    {
                        // Es como un innerJoin de SQL, aquí es donde se une el modelo de usuarios con la suma de los pedidos
                        $lookup: {
                            from: 'usuarios',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'vendedor'
                        }
                    },
                    {
                        // Solo se mostraran como maximo 3 vendedores
                        $limit: 3
                    },
                    {
                        // Se ordena dependiendo que vendedor tuvo mas ventas
                        $sort: {
                            total: -1
                        }
                    }
                ]);
                return vendedores;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        buscarProducto: async (_, { texto }) => {
            try {
                const productos = await Producto.find({ $text: { $search: texto } });
                return productos;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        }
    },
    Mutation: {
        nuevoUsuario: async (_, { input }) => {

            try {
                const { email, password } = input;

                // Revisar si el usuario ya esta registrado
                const existeUsuario = await Usuario.findOne({ email });
                if (existeUsuario) {
                    throw new Error('Ya existe un usuario con ese email');
                }

                // Hashear el password
                const salt = await bcryptjs.genSalt(10);
                input.password = await bcryptjs.hash(password, salt);

                // Guardar en la base de datos
                const usuario = new Usuario(input);
                await usuario.save();
                return usuario;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        autenticarUsuario: async (_, { input }) => {

            const { email, password } = input;

            try {
                const existeUsuario = await Usuario.findOne({ email });
                if (!existeUsuario) {
                    throw new Error('El email o password es incorrecto');
                }

                // Revisar si coincide el password
                const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password);
                if (!passwordCorrecto) {
                    throw new Error('El email o password es incorrecto');
                }

                // Crear el token
                return {
                    token: crearToken(existeUsuario)
                }
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }

            // Revisar si el usuario existe
        },
        nuevoProducto: async (_, { input }) => {
            try {
                const producto = new Producto(input);
                await producto.save();
                return producto;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        actualizarProducto: async (_, { id, input }) => {
            try {
                let producto = await Producto.findById(id);
                if (!producto) {
                    throw new Error('El producto no existe')
                }

                producto = await Producto.findByIdAndUpdate(id, input, { new: true });
                return producto;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        eliminarProducto: async (_, { id }) => {
            try {
                let producto = await Producto.findById(id);
                if (!producto) {
                    throw new Error('El producto no existe')
                }

                producto = await Producto.findByIdAndDelete(id);
                return `El producto ${producto.nombre} fue eliminado correctamente`
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        nuevoCliente: async (_, { input }, ctx) => {
            try {
                const { email } = input;
                // Verificar si el cliente existe
                const existeCliente = await Cliente.findOne({ email });
                if (existeCliente) {
                    throw new Error('Ese cliente ya esta registrado');
                }

                // Asignar vendedor
                const cliente = new Cliente(input);
                cliente.vendedor = ctx.usuario.id;

                // Guardar en la base de datos
                await cliente.save();
                return cliente;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        actualizarCliente: async (_, { id, input }, ctx) => {
            try {
                // Verificar si existe el cliente
                let cliente = await Cliente.findById(id);
                if (!cliente) {
                    throw new Error('No existe el cliente');
                }

                // Verificar si el cliente corresponde al vendedor
                if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                    throw new Error('Este cliente pertenece a otro vendedor');
                }

                // Guardar el cliente
                cliente = await Cliente.findByIdAndUpdate(id, input, { new: true });
                return cliente;

            } catch (error) {
                console.log(error);
                throw new Error(error)
            }
        },
        eliminarCliente: async (_, { id }, ctx) => {
            try {
                // Verificar si existe el cliente
                let cliente = await Cliente.findById(id);
                if (!cliente) {
                    throw new Error('No existe el cliente');
                }

                // Verificar si el cliente corresponde al vendedor
                if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                    throw new Error('Este cliente pertenece a otro vendedor');
                }

                // Guardar el cliente
                cliente = await Cliente.findByIdAndDelete(id);
                return `El cliente ${cliente.nombre} ${cliente.apellido} fue eliminado`;

            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        nuevoPedido: async (_, { input }, ctx) => {
            try {
                // Verificar si existe el cliente
                const cliente = await Cliente.findById(input.cliente);
                if (!cliente) {
                    throw new Error('No existe el cliente');
                }

                // Verificar si el cliente corresponde al vendedor
                if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                    throw new Error('Este cliente pertenece a otro vendedor');
                }

                // Verificar que el stock este disponible
                for await (const prod of input.pedido) {
                    const { producto } = prod;
                    const productoActual = await Producto.findById(producto);
                    if (prod.cantidad > productoActual.existencia) {
                        throw new Error(`El pedido de ${productoActual.nombre} solo cuenta con ${productoActual.existencia} unidades`);
                    }
                }
                for await (const prod of input.pedido) {
                    const { producto } = prod;
                    const productoActual = await Producto.findById(producto);
                    productoActual.existencia = productoActual.existencia - prod.cantidad;
                    await productoActual.save();
                }

                // Crear un nuevo pedido
                const pedido = new Pedido(input);

                // Asignarle un vendedor
                pedido.vendedor = ctx.usuario.id;

                // Guardarlo en la base de datos
                await pedido.save();
                return pedido;

            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        actualizarPedido: async (_, { id, input }, ctx) => {
            try {

                // Verificar si el pedido existe
                const pedidoExiste = await Pedido.findById(id);
                if (!pedidoExiste) {
                    throw new Error('El pedido no existe');
                }

                // Verificar si existe el cliente
                const cliente = await Cliente.findById(input.cliente);
                if (!cliente) {
                    throw new Error('No existe el cliente');
                }

                // Verificar si el cliente y el pedido corresponden al vendedor
                if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                    throw new Error('Este cliente pertenece a otro vendedor');
                }
                if (pedidoExiste.vendedor.toString() !== ctx.usuario.id.toString()) {
                    throw new Error('Este pedido pertenece a otro vendedor');
                }

                if (input.pedido) {
                    // Regresar el pedido
                    for await (const prod of pedidoExiste.pedido) {
                        const { producto } = prod;
                        const productoActual = await Producto.findById(producto);
                        productoActual.existencia = productoActual.existencia + prod.cantidad;
                        await productoActual.save();
                    }
                    // Verificar que el stock este disponible
                    for await (const prod of input.pedido) {
                        const { producto } = prod;
                        const productoActual = await Producto.findById(producto);
                        if (prod.cantidad > productoActual.existencia) {
                            throw new Error(`El pedido de ${productoActual.nombre} solo cuenta con ${productoActual.existencia}`);
                        }
                    }
                    for await (const prod of input.pedido) {
                        const { producto } = prod;
                        const productoActual = await Producto.findById(producto);
                        productoActual.existencia = productoActual.existencia - prod.cantidad;
                        await productoActual.save();
                    }
                }

                // Guardar pedido
                const pedido = await Pedido.findByIdAndUpdate(id, input, { new: true });
                return pedido;

            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        },
        eliminarPedido: async (_, { id }, ctx) => {
            try {
                // Verificar si existe el pedido
                let pedido = await Pedido.findById(id);
                if (!pedido) {
                    throw new Error('El pedido no existe');
                }

                // Verificar que el pedido corresponda al vendedor
                if (pedido.vendedor.toString() !== ctx.usuario.id.toString()) {
                    throw new Error('Este pedido no te corresponde');
                }

                // Actualizar el stock de productos
                for await (const prod of pedido.pedido) {
                    const { producto } = prod;
                    const productoActual = await Producto.findById(producto);
                    productoActual.existencia = productoActual.existencia + prod.cantidad;
                    await productoActual.save();
                }

                // Eliminar pedido
                pedido = await Pedido.findByIdAndDelete(id);
                return `El pedido ${pedido.id} fue eliminado correctamente`;
            } catch (error) {
                console.log(error);
                throw new Error(error);
            }
        }
    }
}

module.exports = resolvers;