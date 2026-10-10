package ru.rsoi.reservation.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.rsoi.reservation.entity.Reservation;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    List<Reservation> findByUsernameOrderByIdDesc(String username);
    Optional<Reservation> findByReservationUid(UUID reservationUid);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Reservation r where r.reservationUid = :uid")
    Optional<Reservation> findByReservationUidForUpdate(@Param("uid") UUID reservationUid);
    long countByUsernameAndStatus(String username, String status);
}
