# Kitap Satış Platformu Projesi

Bu proje, Docker üzerinde çalışan birçok servis içeren bir uygulamadır. Uygulama, kullanıcı kaydı, oturum yönetimi, kitap ekleme ve sipariş verme gibi işlevleri içerir. Ayrıca, MySQL veritabanı, Redis önbelleği ve RabbitMQ mesajlaşma kuyruğu gibi farklı servislerle etkileşimde bulunur.

## Servisler

Bu projede aşağıdaki servisler kullanılmaktadır:

- **MySQL (db)**: Veritabanı yönetimi için kullanılan MySQL 5.7 imajı.
- **Redis (redis)**: Önbellekleme ve oturum yönetimi servisi olarak kullanılan Redis veritabanı.
- **RabbitMQ (rabbitmq)**: Mesajlaşma kuyruğu servisi olarak kullanılan RabbitMQ imajı.
- **User Login Register App**: Kullanıcı kaydı ve oturum yönetimi sağlayan uygulama servisi.
- **Admin App**: Yönetici işlevlerini sağlayan uygulama servisi.
- **Book Store App**: Kitap ekleme ve sipariş işlemlerini sağlayan uygulama servisi.


  
 **Kullanıcı Kaydı ve Oturum Yönetimi**

Kullanıcılar kayıt olduklarında, kullanıcı bilgileri MySQL'e kaydedilir. Kullanıcı giriş yaptığında, oturum bilgileri Redis'te saklanır ve kullanıcı her istek yaptığında Redis üzerinden doğrulanır.

 **Redis Önbelleği**

Projede, Redis kullanılarak bir önbellek oluşturulmuştur. Yeni veri girişi yapıldığında, bu veriler Redis önbelleğinden temizlenir. Bu, verilerin güncel ve doğru kalmasını sağlar.


**Sipariş İşleme**

Kullanıcı bir sipariş verdiğinde, sipariş detayları önce MySQL veritabanına kaydedilir. Ardından, sipariş RabbitMQ üzerinden bir işlem kuyruğuna gönderilir.

     İşlem Adımları

        1. Sipariş Kaydı: Kullanıcı sipariş verdiğinde, sipariş detayları MySQL veritabanına kaydedilir.
        2. İşlem Kuyruğuna Gönderme: Sipariş, RabbitMQ üzerinden bir işlem kuyruğuna gönderilir.
        3. İşlem Kuyruğundan İşleme Alma: RabbitMQ kuyruğunu dinleyen bir fonksiyon, yeni siparişleri işler. Bu fonksiyon, siparişlerin RabbitMQ kuyruğuna düştüğünde otomatik olarak çalışır.
        4. Stoktan Ürün Düşüşü: Sipariş işlenirken, stoktan ürün düşüşü işlemi gerçekleştirilir. Bu işlem, ilgili ürünün stok miktarının güncellenmesini içerir.

## Projenin Kurulumu

Projenin kurulumu için aşağıdaki adımları izleyin:

1. Projeyi klonlayın: `git clone https://github.com/kullanici/proje.git`
2. Klonlanan dizine gidin: `cd proje`
3. Docker Compose ile projeyi başlatın: `docker-compose up`

4. Servisler başlatıldıktan sonra aşağıdaki adreslerden erişebilirsiniz:

- User Login Register App: [http://localhost:4050](http://localhost:4050)
- Admin App: [http://localhost:4060](http://localhost:4060)
- Book Store App: [http://localhost:4070](http://localhost:4070)
- MySQL: `localhost:3308`
- Redis: `localhost:6379`
- RabbitMQ: [http://localhost:15672](http://localhost:15672) (Kullanıcı: `guest`, Şifre: `guest`)



## API Endpointleri

- User Login Register App:
  - POST /login: Kullanıcı girişi yapmak için.
  - POST /register: Yeni kullanıcı kaydı oluşturmak için.
- Admin App:
  - GET /users/getAll: Tüm kullanıcıları listelemek için (sadece yönetici).
  - POST /books/create: Yeni kitap eklemek için (sadece yönetici).
  - GET /orders: Tüm siparişleri listelemek için (sadece yönetici).
- Book Store App:
  - GET /books/getAll: Tüm kitapları listelemek için.
  - GET /books/getById/:id: Belirli bir kitabı ID'ye göre getirmek için.
  - POST /buy: Kitap satın almak için.

## Notlar

- Uygulama, Docker Compose kullanılarak tek bir komutla başlatılabilir.
- Her servisin kendi Docker konteynerinde çalıştığından emin olun.







