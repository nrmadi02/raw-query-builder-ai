import 'dotenv/config'
import { prisma } from '../src/services/db'

async function main() {
  console.log('🌱 Memulai proses seeding data...')

  // 1. Membersihkan data lama (dari anak ke induk untuk menghindari foreign key error)
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()
  await prisma.user.deleteMany()

  // 2. Buat Pengguna Dummy
  const user1 = await prisma.user.create({
    data: { name: 'Andi Madi', email: 'andi@example.com', role: 'customer' }
  })
  
  const user2 = await prisma.user.create({
    data: { name: 'Siti Rahma', email: 'siti@example.com', role: 'admin' }
  })

  // 3. Buat Produk Dummy
  const laptop = await prisma.product.create({
    data: { name: 'Laptop Pro 15', category: 'Elektronik', price: 15000000, stock: 10 }
  })

  const mouse = await prisma.product.create({
    data: { name: 'Wireless Mouse', category: 'Aksesoris', price: 300000, stock: 50 }
  })

  const meja = await prisma.product.create({
    data: { name: 'Meja Kerja Ergonomis', category: 'Perabotan', price: 2500000, stock: 5 }
  })

  // 4. Buat Order Dummy
  // Order 1 (Andi)
  await prisma.order.create({
    data: {
      userId: user1.id,
      totalAmount: 15300000,
      status: 'paid',
      orderItems: {
        create: [
          { productId: laptop.id, quantity: 1, unitPrice: 15000000 },
          { productId: mouse.id, quantity: 1, unitPrice: 300000 }
        ]
      }
    }
  })

  // Order 2 (Siti)
  await prisma.order.create({
    data: {
      userId: user2.id,
      totalAmount: 7500000,
      status: 'delivered',
      orderItems: {
        create: [
          { productId: meja.id, quantity: 3, unitPrice: 2500000 }
        ]
      }
    }
  })

  console.log('✅ Seeding berhasil!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
