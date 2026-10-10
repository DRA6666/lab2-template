package ru.rsoi.library.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import ru.rsoi.library.entity.LibraryBook;
import java.util.List;
import java.util.Optional;

public interface LibraryBookRepository extends JpaRepository<LibraryBook, Long> {
    Optional<LibraryBook> findByLibraryIdAndBookId(Long libraryId, Long bookId);
    List<LibraryBook> findByLibraryId(Long libraryId);

    @Modifying
    @Transactional
    @Query("update LibraryBook lb set lb.availableCount = lb.availableCount - 1 " +
            "where lb.libraryId = :libraryId and lb.bookId = :bookId and lb.availableCount > 0")
    int reserveAvailable(@Param("libraryId") Long libraryId, @Param("bookId") Long bookId);

    @Modifying
    @Transactional
    @Query("update LibraryBook lb set lb.availableCount = lb.availableCount + 1 " +
            "where lb.libraryId = :libraryId and lb.bookId = :bookId")
    int returnAvailable(@Param("libraryId") Long libraryId, @Param("bookId") Long bookId);
}
